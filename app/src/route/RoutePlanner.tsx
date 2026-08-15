import { useReducer, useState } from 'react';
import { appData } from '../data/appData';
import { hasAnyStacks, reduceRouteSteps } from '../data/agentSkills';
import { search } from '../data/search';
import { summarizeRoute } from '../data/summary';
import type { StatKey } from '../data/schema';
import { useStore } from '../state/store';
import { exitRoute } from '../state/urlSync';
import { useSearchNav } from '../search/useSearchNav';
import { Chip } from '../ui/Chip';
import { MonRow } from '../ui/MonRow';
import { Panel, CloseButton } from '../ui/Panel';
import { Sprite } from '../ui/Sprite';
import { StatReqChip } from '../ui/StatReqChip';
import { RouteStepCard } from './RouteStep';
import styles from './RoutePlanner.module.css';

const RANKS = [1, 3, 5, 7, 8, 9, 10];

/** Vertical exchange glyph (up + down arrows) for the From⇄To swap. */
function SwapIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5.5 12.5 V3.5 M3.3 5.7 L5.5 3.5 L7.7 5.7" />
        <path d="M10.5 3.5 V12.5 M8.3 10.3 L10.5 12.5 L12.7 10.3" />
      </g>
    </svg>
  );
}

function EndpointPicker({ which }: { which: 'from' | 'to' }) {
  const value = useStore((s) => s.route[which]);
  const selected = useStore((s) => s.selected);
  const setRouteEndpoint = useStore((s) => s.setRouteEndpoint);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const hits = open && query ? search(appData().searchIndex, query, 6) : [];
  const digimon = value ? appData().db.digimon[value] : null;

  const pick = (slug: string) => {
    setRouteEndpoint(which, slug);
    setQuery('');
    setOpen(false);
  };
  const { highlighted, setHighlighted, onKeyDown } = useSearchNav(hits, {
    onPick: (hit) => pick(hit.slug),
    onClose: () => setOpen(false),
  });

  return (
    <div className={styles.endpoint} data-endpoint={which}>
      <span className={`label ${styles.endpointLabel}`}>{which === 'from' ? 'From' : 'To'}</span>
      {digimon ? (
        <button
          className={styles.endpointValue}
          onClick={() => setRouteEndpoint(which, null)}
          title="Clear"
        >
          <Sprite slug={digimon.slug} size={22} />
          {digimon.name} ✕
        </button>
      ) : (
        <div className={styles.endpointSearch}>
          <input
            value={query}
            placeholder="Search…"
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setHighlighted(0);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={onKeyDown}
            spellCheck={false}
          />
          {selected && selected !== value && (
            <button
              className={styles.useSelected}
              onMouseDown={(e) => {
                e.preventDefault();
                setRouteEndpoint(which, selected);
              }}
            >
              use selected
            </button>
          )}
          {hits.length > 0 && (
            <div className={styles.endpointDropdown}>
              {hits.map((hit, i) => (
                <MonRow
                  key={hit.slug}
                  slug={hit.slug}
                  size={20}
                  active={i === highlighted}
                  onMouseEnter={() => setHighlighted(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(hit.slug);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function RoutePlanner() {
  const route = useStore((s) => s.route);
  const agentSkills = useStore((s) => s.agentSkills);
  const swapRoute = useStore((s) => s.swapRoute);
  const setMaxAgentRank = useStore((s) => s.setMaxAgentRank);
  const setAvoidJogress = useStore((s) => s.setAvoidJogress);
  const setActiveRoute = useStore((s) => s.setActiveRoute);
  const setActiveStep = useStore((s) => s.setActiveStep);
  // Each swap adds a half-turn to the glyph so the flip stays directional
  // however many times it's pressed (reduced-motion snaps it — tokens.css).
  const [flips, flip] = useReducer((n: number) => n + 1, 0);
  const canSwap = Boolean(route.from || route.to);

  const routes = route.routes;
  const active = routes?.[route.active];
  const summary = active && active.steps.length ? summarizeRoute(active.steps) : null;
  // A second fold over the same steps with each step's stat thresholds reduced
  // by the player's bond stacks — so the summary ceiling matches the per-step
  // cards. Only computed when at least one bond is stacked.
  const reducedSummary =
    active && summary && hasAnyStacks(agentSkills)
      ? summarizeRoute(reduceRouteSteps(active.steps, appData().db, agentSkills))
      : null;
  // "Avoid if possible" honesty: the demotion ranks any jogress-free route first,
  // so if EVERY route still has a jogress step, none exists — say so plainly.
  const noJogressFree =
    route.avoidJogress &&
    !!routes &&
    routes.length > 0 &&
    routes.every((r) => r.steps.some((s) => s.class === 'jogress'));

  return (
    <Panel>
      <header className={styles.header}>
        <h2>Route Planner</h2>
        <CloseButton onClick={exitRoute} title="Close (Esc)" />
      </header>

      <div className={styles.inputs}>
        <div className={styles.endpoints}>
          <EndpointPicker which="from" />
          <button
            type="button"
            className={styles.swap}
            onClick={() => {
              swapRoute();
              flip();
            }}
            disabled={!canSwap}
            title="Swap From and To"
            aria-label="Swap From and To"
          >
            <span className={styles.swapGlyph} style={{ transform: `rotate(${flips * 180}deg)` }}>
              <SwapIcon />
            </span>
          </button>
          <EndpointPicker which="to" />
        </div>
        <label className={styles.rank}>
          My agent rank
          <select
            value={route.maxAgentRank ?? ''}
            onChange={(e) => setMaxAgentRank(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">any</option>
            {RANKS.map((rank) => (
              <option key={rank} value={rank}>
                {rank}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.avoid}>
          <input
            type="checkbox"
            className={styles.avoidInput}
            checked={route.avoidJogress}
            onChange={(e) => setAvoidJogress(e.target.checked)}
          />
          <span className={styles.avoidBox} aria-hidden="true">
            <svg viewBox="0 0 12 12" width="11" height="11" focusable="false">
              <path
                d="M2.5 6.2 L5 8.6 L9.5 3.4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className={styles.avoidLabel}>Avoid Jogress/DNA evolutions if possible</span>
        </label>
      </div>

      <div className={styles.scroll}>
        {!route.from || !route.to ? (
          <p className={styles.empty}>Pick a start and a target Digimon.</p>
        ) : !routes || routes.length === 0 ? (
          <p className={styles.empty}>
            No route found{route.maxAgentRank ? ' at this agent rank' : ''}.
          </p>
        ) : (
          <>
            {noJogressFree && (
              <p className={styles.avoidNote}>
                <span aria-hidden="true">⧉</span>
                No Jogress/DNA-free route exists — showing the path with the fewest Jogress/DNA steps.
              </p>
            )}

            {routes.length > 1 && (
              <div className={styles.pager}>
                <button
                  disabled={route.active === 0}
                  onClick={() => setActiveRoute(route.active - 1)}
                >
                  ‹
                </button>
                <span>
                  Route {route.active + 1} / {routes.length}
                </span>
                <button
                  disabled={route.active === routes.length - 1}
                  onClick={() => setActiveRoute(route.active + 1)}
                >
                  ›
                </button>
              </div>
            )}

            {active && summary && (
              <div className={styles.summary}>
                <div className={styles.summaryCounts}>
                  {active.steps.length} steps · {summary.counts.digivolves}▲{' '}
                  {summary.counts.dedigivolves}▼
                </div>
                <div className={styles.summaryPills}>
                  <Chip>Rank ≥ {summary.maxAgentRank}</Chip>
                  {Object.entries(summary.maxStats).map(([stat, value]) => (
                    <StatReqChip
                      key={stat}
                      label={stat}
                      base={value}
                      reduced={reducedSummary ? (reducedSummary.maxStats[stat as StatKey] ?? value) : value}
                    />
                  ))}
                  {summary.maxTalent != null && <Chip>Talent ≥ {summary.maxTalent}</Chip>}
                  {summary.items.map((item) => (
                    <Chip key={item} color="var(--item)">
                      ◆ {item}
                    </Chip>
                  ))}
                  {summary.partners.map((partner) => (
                    <Chip key={partner.slug} color="var(--jogress)">
                      ⧉ {partner.name}
                    </Chip>
                  ))}
                  {summary.agentSkills.map((skill) => (
                    <Chip key={skill.category} color="var(--bond)">
                      ❖ {skill.category} {skill.value}
                    </Chip>
                  ))}
                </div>
                <div className={styles.caption}>
                  Stat thresholds apply at each step, not all at once.
                  {reducedSummary && (
                    <span className={styles.summaryNote}>
                      <span className={styles.summaryNoteGlyph} aria-hidden="true">
                        ❖
                      </span>
                      Reduced by your Agent Skills on steps whose personality you match.
                    </span>
                  )}
                </div>
              </div>
            )}

            {active?.steps.length === 0 && (
              <p className={styles.empty}>Already there — same Digimon.</p>
            )}
            {active?.steps.map((step, i) => (
              <RouteStepCard
                key={`${step.from}-${step.to}-${i}`}
                step={step}
                index={i}
                active={route.activeStep === i}
                onHover={(hovering) => setActiveStep(hovering ? i : null)}
              />
            ))}
          </>
        )}
      </div>
    </Panel>
  );
}
