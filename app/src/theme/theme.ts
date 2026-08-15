// Light/dark chrome theme. Persisted, system-default, applied via a data-theme
// attribute on <html> (tokens.css overrides only on [data-theme='light']).
// The graph viewport is themed too: --graph-bg (CSS) + GRAPH_PALETTES (JS, for
// Cytoscape) each carry a dark and a light stage. subscribeTheme drives both.
export type Theme = 'light' | 'dark';

const KEY = 'tst.theme';
const listeners = new Set<(t: Theme) => void>();
let current: Theme = 'dark';
let themingTimer = 0;

function systemPref(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/** Run before first paint (also mirrored by an inline script in index.html). */
export function initTheme(): Theme {
  // Runs synchronously at module load, before React mounts. Storage access can
  // throw (Safari "Block all cookies", a storage-blocked iframe, Firefox with
  // dom.storage disabled) — swallow it so the app still paints (falling back to
  // the system preference) rather than aborting startup with a blank page.
  let stored: Theme | null = null;
  try {
    stored = localStorage.getItem(KEY) as Theme | null;
  } catch {
    /* storage blocked — fall back to the system preference */
  }
  current = stored === 'light' || stored === 'dark' ? stored : systemPref();
  document.documentElement.setAttribute('data-theme', current);
  return current;
}

export function getTheme(): Theme {
  return current;
}

export function setTheme(theme: Theme): void {
  current = theme;
  const root = document.documentElement;
  // Cross-fade the neutral palette on toggle only (a `data-theming` window), so the
  // whole page doesn't hard-snap between light and dark — without paying a color
  // transition on every hover/press during normal use. Skipped under reduced motion.
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  if (!reduce) {
    root.setAttribute('data-theming', '');
    window.clearTimeout(themingTimer);
    themingTimer = window.setTimeout(() => root.removeAttribute('data-theming'), 340);
  }
  root.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* storage blocked — the choice just won't persist across sessions */
  }
  listeners.forEach((l) => l(theme));
}

export function toggleTheme(): void {
  setTheme(current === 'dark' ? 'light' : 'dark');
}

export function subscribeTheme(listener: (t: Theme) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
