import { useEffect, type RefObject } from 'react';

/**
 * Global quick-search shortcut: '/' (when not already typing) or Ctrl+K focuses
 * and selects the given input. Shared by the graph SearchBox and the Codex
 * filter so the shortcut works on whichever search is currently on screen.
 */
export function useSearchHotkey(inputRef: RefObject<HTMLInputElement | null>): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = (event.target as HTMLElement)?.tagName === 'INPUT';
      if ((event.key === '/' && !typing) || (event.key === 'k' && event.ctrlKey)) {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inputRef]);
}
