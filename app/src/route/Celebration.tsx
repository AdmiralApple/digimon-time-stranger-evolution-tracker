import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { appData } from '../data/appData';
import { useStore } from '../state/store';
import { nodeAccentHex } from '../theme/chroma';
import styles from './Celebration.module.css';

interface Burst {
  label: string;
  steps: number;
  color: string;
}

/** A small peak-moment flourish when a route is successfully plotted — in the
 *  destination Digimon's own signature colour. */
export function Celebration() {
  const routeOpen = useStore((s) => s.routeOpen);
  const from = useStore((s) => s.route.from);
  const to = useStore((s) => s.route.to);
  const routes = useStore((s) => s.route.routes);
  const [burst, setBurst] = useState<Burst | null>(null);
  const lastKey = useRef('');

  useEffect(() => {
    if (!routeOpen || !from || !to || !routes || !routes.length) {
      lastKey.current = '';
      return;
    }
    const key = `${from}|${to}|${routes.length}`;
    if (key === lastKey.current) return;
    // Read the active route imperatively rather than subscribing to it: paging
    // between alternatives changes `route.active` but must NOT re-run this effect
    // — React's cleanup would cancel the pending auto-dismiss, and the unchanged
    // key would then skip rescheduling it, stranding the toast on screen. On a
    // fresh plot the active index is always 0.
    const route = routes[useStore.getState().route.active];
    if (!route || !route.steps.length) return;
    lastKey.current = key;

    setBurst({
      label: appData().db.digimon[to].name,
      steps: route.steps.length,
      color: nodeAccentHex(to),
    });
    const id = window.setTimeout(() => setBurst(null), 2400);
    return () => window.clearTimeout(id);
  }, [routeOpen, from, to, routes]);

  if (!burst) return null;

  return (
    <div className={styles.wrap} style={{ '--cel': burst.color } as CSSProperties}>
      <div className={styles.glow} />
      <div className={styles.toast} role="status">
        <span className={styles.star}>✦</span>
        Route to {burst.label} — {burst.steps} {burst.steps === 1 ? 'step' : 'steps'}
      </div>
    </div>
  );
}
