import { appData } from '../data/appData';
import { useStore } from './store';

// Hand-rolled hash sync (no router):
//   #/codex               Codex table view     (pushState — browser Back returns to the Tree)
//   #/d/{slug}            selection            (replaceState — no history spam)
//   #/f/{slug}            focus mode           (pushState — browser Back exits)
//   #/route/{from}/{to}   route planner        (pushState)
let applying = false;

function applyHash(): void {
  applying = true;
  try {
    const store = useStore.getState();
    const exists = (slug: string) => Boolean(appData().db.digimon[slug]);
    const focusMatch = location.hash.match(/^#\/f\/([a-z0-9-]+)$/);
    const detailMatch = location.hash.match(/^#\/d\/([a-z0-9-]+)$/);
    const routeMatch = location.hash.match(/^#\/route\/([a-z0-9-]+)\/([a-z0-9-]+)$/);
    const codexMatch = /^#\/codex\/?$/.test(location.hash);

    if (focusMatch && exists(focusMatch[1])) {
      store.setView('graph');
      store.closeRoute();
      store.select(focusMatch[1]);
      store.setFocus(focusMatch[1]);
    } else if (routeMatch && exists(routeMatch[1]) && exists(routeMatch[2])) {
      store.setView('graph');
      store.setFocus(null);
      store.openRoute({ from: routeMatch[1], to: routeMatch[2] });
    } else if (detailMatch && exists(detailMatch[1])) {
      store.setView('graph');
      store.closeRoute();
      store.setFocus(null);
      store.select(detailMatch[1]);
    } else if (codexMatch) {
      store.setView('codex'); // clears focus / route (see store.setView)
    } else {
      store.setView('graph');
      store.setFocus(null);
      store.closeRoute();
    }
  } finally {
    applying = false;
  }
}

/** Exit focus without breaking Back: if focus pushed this hash entry, go back
 *  (so Back never re-enters focus); otherwise just clear. */
export function exitFocus(): void {
  if (location.hash.startsWith('#/f/')) {
    history.back(); // hashchange → applyHash clears focus
  } else {
    useStore.getState().setFocus(null);
  }
}

export function exitRoute(): void {
  if (location.hash.startsWith('#/route/')) {
    history.back();
  } else {
    useStore.getState().closeRoute();
  }
}

export function initUrlSync(): void {
  window.addEventListener('hashchange', applyHash);
  applyHash(); // deep-link on boot

  useStore.subscribe(
    (s) => ({
      view: s.view,
      selected: s.selected,
      focus: s.focus,
      routeOpen: s.routeOpen,
      routeFrom: s.route.from,
      routeTo: s.route.to,
    }),
    ({ view, selected, focus, routeOpen, routeFrom, routeTo }) => {
      if (applying) return;
      const target = focus
        ? `#/f/${focus}`
        : routeOpen && routeFrom && routeTo
          ? `#/route/${routeFrom}/${routeTo}`
          : view === 'codex'
            ? '#/codex'
            : selected
              ? `#/d/${selected}`
              : '';
      if (location.hash === target) return;

      const url = target || location.pathname + location.search;
      // Focus, Route and Codex are full mode changes worth a history entry, so
      // browser Back leaves them; selection just replaces (no history spam).
      // Leaving the Codex for the Tree (openInTree) is the mirror case: push so
      // Back returns to the Field Guide instead of collapsing the #/codex entry.
      const entering =
        (focus && !location.hash.startsWith('#/f/')) ||
        (routeOpen && routeFrom && routeTo && !location.hash.startsWith('#/route/')) ||
        (view === 'codex' && location.hash !== '#/codex') ||
        (view !== 'codex' && location.hash === '#/codex');
      if (entering) history.pushState(null, '', url);
      else history.replaceState(null, '', url);
    },
    {
      equalityFn: (a, b) =>
        a.view === b.view &&
        a.selected === b.selected &&
        a.focus === b.focus &&
        a.routeOpen === b.routeOpen &&
        a.routeFrom === b.routeFrom &&
        a.routeTo === b.routeTo,
    },
  );
}
