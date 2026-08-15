import { useState, type KeyboardEvent } from 'react';

interface SearchNavOptions<T> {
  onPick: (item: T, shiftKey: boolean) => void;
  onClose?: () => void;
}

/**
 * Shared keyboard behaviour for the app's search comboboxes (top search + route
 * endpoint picker): ↓/↑ to move, Enter to pick the highlighted item, Esc to
 * close. `highlighted` is clamped to the current result set, so callers only
 * need to reset it to 0 when the query changes.
 */
export function useSearchNav<T>(items: T[], { onPick, onClose }: SearchNavOptions<T>) {
  const [raw, setHighlighted] = useState(0);
  const highlighted = Math.min(raw, Math.max(0, items.length - 1));

  const onKeyDown = (event: KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
        if (items.length) {
          event.preventDefault();
          setHighlighted(Math.min(highlighted + 1, items.length - 1));
        }
        break;
      case 'ArrowUp':
        if (items.length) {
          event.preventDefault();
          setHighlighted(Math.max(highlighted - 1, 0));
        }
        break;
      case 'Enter':
        if (items.length) {
          event.preventDefault();
          onPick(items[highlighted], event.shiftKey);
        }
        break;
      case 'Escape':
        onClose?.();
        break;
    }
  };

  return { highlighted, setHighlighted, onKeyDown };
}
