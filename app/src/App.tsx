import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import styles from './App.module.css';
import { initAppData } from './data/appData';
import { loadDatabase } from './data/load';
import { preloadAtlas } from './data/atlas';
import { FilterBar } from './filters/FilterBar';
import { GraphCanvas } from './graph/GraphCanvas';
import { HiddenBranches } from './graph/HiddenBranches';
import { Celebration } from './route/Celebration';
import { DetailPanel } from './panel/DetailPanel';
import { EmptyPanel } from './panel/EmptyPanel';
import { RoutePlanner } from './route/RoutePlanner';
import { SearchBox } from './search/SearchBox';
import { SettingsMenu } from './settings/SettingsMenu';
import { DiscoveryMenu } from './discovery/DiscoveryMenu';
import { CodexPage } from './codex/CodexPage';
import { useStore } from './state/store';
import { exitFocus, exitRoute, initUrlSync } from './state/urlSync';
import { ATTRIBUTE_COLORS } from './theme/attribute';
import { ATTRIBUTE_KEYS } from './data/schema';
import { useChromaticAccent } from './theme/useChromaticAccent';
import { BrandMark } from './ui/BrandMark';
import { SegButton } from './ui/SegButton';
import { ThemeToggle } from './ui/ThemeToggle';
import { ViewSwitch } from './ui/ViewSwitch';
import { useMediaQuery } from './ui/useMediaQuery';
import { useSheetDrag } from './ui/useSheetDrag';

function useGlobalKeys() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
      const store = useStore.getState();
      // Focus / Escape act on the graph; the Codex is a separate surface with no
      // lineage focus or route to drive, so its keys are left alone there.
      if (store.view !== 'graph') return;
      if (event.key === 'Escape') {
        if (store.focus) exitFocus();
        else if (store.routeOpen) exitRoute();
        else store.select(null);
      } else if (event.key === 'f' || event.key === 'F') {
        if (store.selected) store.setFocus(store.focus === store.selected ? null : store.selected);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

function Splash({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.splash}>
      <div className={styles.splashMark}>
        <BrandMark size={56} animated />
      </div>
      <h1 className={styles.splashTitle}>
        Time Stranger <span>Tree</span>
      </h1>
      {children}
    </div>
  );
}

type PanelMode = 'dock' | 'drawer' | 'sheet';

// Fallback collapsed-sheet height until the panel header is measured.
const SHEET_PEEK_FALLBACK = 96;

/**
 * Hosts the detail / route / empty panel. On desktop the panel is docked in the
 * flex row and displaces the graph (master–detail). Below 1024px the graph stays
 * full-bleed and the panel floats over it: a right-hand drawer on tablets, a
 * bottom sheet on phones. The same panel components render in every mode — only
 * the container and its dismiss affordances change.
 *
 * The phone sheet has three states: expanded, collapsed, and closed. Dragging /
 * tapping the grip toggles expanded ↔ collapsed; collapsing slides the sheet down
 * until only its own header row (icon · name · #number · tags · ✕) peeks above
 * the bottom edge, so the focused / route graph is visible while the selection
 * stays put. Closing is the explicit ✕ in that header, never the drag.
 */
function PanelHost({
  mode,
  open,
  collapsed,
  onCollapse,
  onExpand,
  children,
}: {
  mode: PanelMode;
  open: boolean;
  collapsed: boolean;
  onCollapse: () => void;
  onExpand: () => void;
  children: React.ReactNode;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  // Retain the last content so the slide-out animation isn't blank while the
  // store has already cleared the selection.
  const [content, setContent] = useState<React.ReactNode>(children);
  useEffect(() => {
    if (open) setContent(children);
  }, [open, children]);
  // Clear any drag-applied inline transform whenever the open/collapsed state
  // changes so the CSS class for the new state animates it into place.
  useEffect(() => {
    if (hostRef.current) {
      hostRef.current.style.transform = '';
      hostRef.current.style.transition = '';
    }
  }, [open, collapsed]);

  const sheet = mode === 'sheet';

  // Collapsed peek height = the grip + the panel's own header row. Measured so it
  // tracks the header exactly (including chips wrapping to a second line) and
  // re-measured when the content swaps or the header reflows.
  const [peekPx, setPeekPx] = useState(SHEET_PEEK_FALLBACK);
  useLayoutEffect(() => {
    if (!sheet) return;
    const host = hostRef.current;
    if (!host) return;
    const measure = () => {
      const header = host.querySelector('header');
      if (header instanceof HTMLElement) setPeekPx(header.offsetTop + header.offsetHeight);
    };
    measure();
    const header = host.querySelector('header');
    if (!(header instanceof HTMLElement)) return;
    const ro = new ResizeObserver(measure);
    ro.observe(header);
    return () => ro.disconnect();
  }, [sheet, content, open]);

  const drag = useSheetDrag(hostRef, {
    enabled: sheet,
    collapsed,
    onCollapse,
    onExpand,
    peekPx,
  });

  // Docked: the panel is a normal flex child; no overlay chrome.
  if (mode === 'dock') return <>{children}</>;

  return (
    <div
      ref={hostRef}
      className={styles.panelHost}
      data-mode={mode}
      data-open={open}
      data-collapsed={sheet && collapsed}
      aria-hidden={!open}
      style={sheet ? ({ '--sheet-peek': `${peekPx}px` } as CSSProperties) : undefined}
    >
      {sheet && (
        <button
          type="button"
          className={styles.grip}
          aria-label={collapsed ? 'Expand panel' : 'Minimize panel'}
          aria-expanded={!collapsed}
          {...drag}
        >
          <span className={styles.gripBar} />
        </button>
      )}
      {content}
    </div>
  );
}

export default function App() {
  const ready = useStore((s) => s.ready);
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const selected = useStore((s) => s.selected);
  const routeOpen = useStore((s) => s.routeOpen);
  const focus = useStore((s) => s.focus);
  const filtersOpen = useStore((s) => s.filtersOpen);
  const setFiltersOpen = useStore((s) => s.setFiltersOpen);
  const openRoute = useStore((s) => s.openRoute);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Layout mode is breakpoint-driven: docked ≥1024, drawer 640–1023, sheet <640.
  const overlay = useMediaQuery('(max-width: 1023px)');
  const compact = useMediaQuery('(max-width: 639px)');
  const panelMode: PanelMode = !overlay ? 'dock' : compact ? 'sheet' : 'drawer';

  useChromaticAccent();

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    loadDatabase(controller.signal)
      .then((db) => {
        initAppData(db);
        useStore.getState().setReady();
        initUrlSync();
        preloadAtlas();
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          console.error('Failed to load Digimon database:', err);
          setError(String(err));
        }
      });
    return () => controller.abort();
  }, [attempt]);

  useGlobalKeys();

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  // Phone bottom-sheet peek state. Collapsing keeps the route / selection (and
  // the graph behind it) alive — closing is the explicit ✕ in the panel header.
  // Reset to expanded whenever what the panel shows changes, so a fresh pick
  // always opens fully.
  const [sheetCollapsed, setSheetCollapsed] = useState(false);
  useEffect(() => {
    setSheetCollapsed(false);
  }, [selected, routeOpen]);

  if (error) {
    return (
      <Splash>
        <div className={styles.error}>
          <p className={styles.errorMsg}>
            Couldn&rsquo;t reach the Digital World. Check your connection, then try again.
          </p>
          <button className={styles.retry} onClick={retry}>
            Try again
          </button>
        </div>
      </Splash>
    );
  }
  if (!ready) {
    return (
      <Splash>
        <div className={styles.loadingBar} role="status" aria-label="Loading the Digital World" />
      </Splash>
    );
  }

  // The idle "welcome" panel only earns its keep as a docked column; when the
  // graph is full-bleed it stays out of the way until the user picks something.
  const panelContent = routeOpen ? (
    <RoutePlanner />
  ) : selected ? (
    // key by slug so switching Digimon replays the panel's entrance (and the
    // stat bars re-fill) rather than swapping content in place
    <DetailPanel key={selected} slug={selected} />
  ) : panelMode === 'dock' ? (
    <EmptyPanel />
  ) : null;

  return (
    <div className={styles.shell}>
      <header className={styles.topbar} data-view={view}>
        <div className={styles.brand}>
          <span className={styles.mark}>
            <BrandMark size={22} />
          </span>
          <h1 className={styles.title}>
            Time Stranger <span className={styles.titleAccent}>Tree</span>
          </h1>
        </div>
        <div className={styles.viewSwitch}>
          <ViewSwitch value={view} onChange={setView} />
        </div>
        {view === 'graph' && (
          <>
            <div className={styles.search}>
              <SearchBox />
            </div>
            <div className={styles.viewActions}>
              <SegButton active={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>
                Filters
              </SegButton>
              <SegButton active={routeOpen} onClick={() => (routeOpen ? exitRoute() : openRoute())}>
                Route
              </SegButton>
              {focus && (
                <SegButton active onClick={exitFocus} title="Exit focus (Esc)">
                  ◈ <span className={styles.focusFull}>Focused — exit</span>
                  <span className={styles.focusShort}>Exit</span>
                </SegButton>
              )}
            </div>
          </>
        )}
        <div className={styles.sysActions}>
          {/* Settings + Field Guide carry graph controls (layout, spoiler-free
              fog), so they hide on the Codex alongside the other graph-only chrome. */}
          {view === 'graph' && <DiscoveryMenu />}
          {view === 'graph' && <SettingsMenu />}
          <ThemeToggle />
        </div>
      </header>
      {view === 'graph' && (
        <div className={styles.filterReveal} data-open={filtersOpen}>
          <div className={styles.filterRevealInner} inert={!filtersOpen}>
            <FilterBar />
          </div>
        </div>
      )}
      <div className={styles.body}>
        {/* Kept mounted under the Codex so Cytoscape retains its viewport; `inert`
            drops the covered surface out of the tab order and the a11y tree. */}
        <div className={styles.graphSurface} inert={view === 'codex'}>
          <main className={styles.canvas}>
            <GraphCanvas />
            <Celebration />
            <HiddenBranches />
            <div className={styles.legend}>
              <span className={styles.legendTitle}>Attribute</span>
              {ATTRIBUTE_KEYS.map((attribute) => (
                <span key={attribute} className={styles.legendItem}>
                  <span
                    className={styles.legendDot}
                    style={{ background: ATTRIBUTE_COLORS[attribute] }}
                  />
                  {attribute}
                </span>
              ))}
            </div>
          </main>
          <PanelHost
            mode={panelMode}
            open={routeOpen || Boolean(selected)}
            collapsed={sheetCollapsed}
            onCollapse={() => setSheetCollapsed(true)}
            onExpand={() => setSheetCollapsed(false)}
          >
            {panelContent}
          </PanelHost>
        </div>
        {view === 'codex' && (
          <div className={styles.codexLayer}>
            <CodexPage />
          </div>
        )}
      </div>
    </div>
  );
}
