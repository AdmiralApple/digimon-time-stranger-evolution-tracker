import { useCallback, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { appData } from '../data/appData';
import { useAnchoredPopover } from '../ui/useAnchoredPopover';
import { SAVE_FILE_ACCEPT, SAVE_FILE_EXAMPLE, SAVE_PATH } from './saveMeta';
import styles from './DiscoveryMenu.module.css';

/** Monochrome open-book glyph — reads as "field guide", stays graphite. */
function GuideIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M8 3.4C6.8 2.5 5 2.1 2.7 2.1v9.5C5 11.6 6.8 12 8 12.9" />
      <path d="M8 3.4C9.2 2.5 11 2.1 13.3 2.1v9.5C11 11.6 9.2 12 8 12.9" />
      <path d="M8 3.4v9.5" />
    </svg>
  );
}

/** Field Guide fog-of-war control: import a save, toggle spoiler-free mode, and
 *  read your discovery progress. Save parsing is entirely client-side. */
export function DiscoveryMenu() {
  const [open, setOpen] = useState(false);
  const discovery = useStore((s) => s.discovery);
  const importSave = useStore((s) => s.importSave);
  const setDiscoveryMode = useStore((s) => s.setDiscoveryMode);
  const setFrontier = useStore((s) => s.setFrontier);
  const clearDiscovery = useStore((s) => s.clearDiscovery);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const total = appData().graph.slugs.length;
  const discovered = discovery.discovered.size;
  const registered = discovery.registered.size;
  const hasSave = discovered > 0 || registered > 0;
  const pct = (n: number) => (total ? (n / total) * 100 : 0);

  const place = useCallback(() => {
    const btn = triggerRef.current;
    const pop = popRef.current;
    if (!btn || !pop) return;
    const M = 8;
    const r = btn.getBoundingClientRect();
    // offsetWidth reads 0 on the first shown frame; fall back to the CSS width so
    // the right-edge clamp still holds.
    const w = pop.offsetWidth || 300;
    const h = pop.offsetHeight || 0;
    const left = Math.max(M, Math.min(r.right - w, window.innerWidth - w - M));
    const top = Math.max(M, Math.min(r.bottom + M, window.innerHeight - h - M));
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  }, []);

  useAnchoredPopover({ open, setOpen, wrapRef, popRef, place });

  const onFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = ''; // allow re-picking the same file after it advances
      if (!file) return;
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const res = importSave(bytes);
        setMsg({
          ok: true,
          text: `Loaded ${res.player || 'save'} — ${res.discovered} discovered, ${res.registered} registered.`,
        });
      } catch (err) {
        setMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
      }
    },
    [importSave],
  );

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        ref={triggerRef}
        className={open ? `${styles.trigger} ${styles.triggerOpen}` : styles.trigger}
        onClick={() => setOpen(!open)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Game progress — import save, spoiler-free mode"
        title="Game progress — import save, spoiler-free mode"
      >
        <span className={styles.icon}>
          <GuideIcon />
        </span>
        {discovery.mode && hasSave && <span className={styles.statusDot} aria-hidden="true" />}
      </button>

      <div ref={popRef} popover="manual" className={styles.pop}>
        <div className={styles.head}>
          <span className={styles.title}>Game progress</span>
          {hasSave && discovery.player && (
            <span className={styles.player}>{discovery.player}’s save</span>
          )}
        </div>

        {hasSave && (
          <div className={styles.progress}>
            <div
              className={styles.meter}
              role="img"
              aria-label={`${discovered} of ${total} discovered, ${registered} registered`}
            >
              <div className={styles.meterSeen} style={{ width: `${pct(discovered)}%` }} />
              <div className={styles.meterReg} style={{ width: `${pct(registered)}%` }} />
            </div>
            <div className={styles.legend}>
              <span className={styles.legendItem}>
                <span className={`${styles.sw} ${styles.swReg}`} />
                <span className={styles.legendNum}>{registered}</span> registered
              </span>
              <span className={styles.legendItem}>
                <span className={`${styles.sw} ${styles.swSeen}`} />
                <span className={styles.legendNum}>{discovered}</span> discovered
              </span>
              <span className={styles.legendItem}>
                <span className={styles.legendTotal}>of {total}</span>
              </span>
            </div>
          </div>
        )}

        <div className={styles.field}>
          <span className={styles.fieldLabel}>Spoiler-free mode</span>
          <div className={styles.seg} role="group" aria-label="Spoiler-free mode">
            <button
              className={discovery.mode ? styles.segActive : styles.segBtn}
              aria-pressed={discovery.mode}
              onClick={() => setDiscoveryMode(true)}
            >
              On
            </button>
            <button
              className={!discovery.mode ? styles.segActive : styles.segBtn}
              aria-pressed={!discovery.mode}
              onClick={() => setDiscoveryMode(false)}
            >
              Off
            </button>
          </div>
          <span className={styles.hint}>
            Hides Digimon you haven’t met; each new discovery lights up its evolution links.
          </span>
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>Frontier hints</span>
          <div className={styles.seg} role="group" aria-label="Frontier hints">
            <button
              className={discovery.frontier ? styles.segActive : styles.segBtn}
              aria-pressed={discovery.frontier}
              onClick={() => setFrontier(true)}
            >
              Silhouettes
            </button>
            <button
              className={!discovery.frontier ? styles.segActive : styles.segBtn}
              aria-pressed={!discovery.frontier}
              onClick={() => setFrontier(false)}
            >
              Hidden
            </button>
          </div>
          <span className={styles.hint}>
            Show a “?” only for unmet Digimon directly connected to something you&rsquo;ve revealed.
          </span>
        </div>

        <button className={styles.importBtn} onClick={() => fileRef.current?.click()}>
          {hasSave ? 'Re-import updated save' : 'Import save file'}
        </button>
        <input
          ref={fileRef}
          type="file"
          className={styles.file}
          accept={SAVE_FILE_ACCEPT}
          onChange={onFile}
        />
        {msg && <span className={msg.ok ? styles.msgOk : styles.msgErr}>{msg.text}</span>}
        <span className={styles.hint}>
          Read locally in your browser — nothing is uploaded.
          <span className={styles.path}>
            For Steam: {SAVE_PATH}
            <br />
            Example: {SAVE_FILE_EXAMPLE}
          </span>
        </span>

        {hasSave && (
          <div className={styles.footer}>
            <span className={styles.footNote}>Advances as you play — just re-import.</span>
            <button
              className={styles.clear}
              onClick={() => {
                clearDiscovery();
                setMsg(null);
              }}
            >
              Clear
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
