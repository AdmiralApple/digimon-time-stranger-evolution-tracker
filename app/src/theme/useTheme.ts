import { useSyncExternalStore } from 'react';
import { getTheme, subscribeTheme, toggleTheme, type Theme } from './theme';

/** Current chrome theme + a toggle, kept in sync with the theme module. */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, getTheme);
  return { theme, toggle: toggleTheme };
}
