import { useEffect, useState } from 'react';

/**
 * Subscribe to a CSS media query from React. Used to switch the shell's
 * information architecture at breakpoints — a docked side panel on desktop, a
 * floating drawer on tablets, a bottom sheet on phones — rather than trying to
 * express layout-mode changes in CSS alone (which can't unmount the idle panel
 * or drive the drag gesture).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange(); // sync in case the query changed between render and effect
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
