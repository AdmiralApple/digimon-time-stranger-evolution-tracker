import { useEffect, type RefObject } from 'react';

/**
 * Shared behaviour for the app's manual top-layer popovers (Settings, Hidden
 * branches, Personality filter). Given the open state and a positioner, it:
 *   • shows / hides the native `popover="manual"` element and positions it,
 *   • closes on an outside pointerdown or a *captured* Escape — so Escape closes
 *     the popover without also unwinding lineage focus / the route via the global
 *     key handler,
 *   • repositions on window resize.
 *
 * Positioning differs per popover (left/right anchor, height cap), so the caller
 * supplies `place`; the show/hide + dismiss wiring is identical and lives here.
 * Pass stable callbacks (`place`, `onEscape`) — e.g. via `useCallback` — so the
 * listener effect doesn't re-subscribe on every render.
 */
export function useAnchoredPopover({
  open,
  setOpen,
  wrapRef,
  popRef,
  place,
  onEscape,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  wrapRef: RefObject<HTMLElement | null>;
  popRef: RefObject<HTMLElement | null>;
  place: () => void;
  /** Extra work when Escape closes the popover (e.g. return focus to the trigger). */
  onEscape?: () => void;
}): void {
  // Drive the native popover from `open`, so it can also be opened from elsewhere
  // and always paints in the top layer (above the detail panel / bottom sheet).
  useEffect(() => {
    const pop = popRef.current;
    if (!pop) return;
    if (open) {
      if (!pop.matches(':popover-open')) pop.showPopover();
      place();
    } else if (pop.matches(':popover-open')) {
      pop.hidePopover();
    }
  }, [open, place, popRef]);

  // A `manual` popover doesn't light-dismiss, so keep our own outside-pointer +
  // Escape handling. Reposition on resize.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (
        !wrapRef.current?.contains(e.target as Node) &&
        !popRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        onEscape?.();
      }
    };
    const onResize = () => place();
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, setOpen, place, wrapRef, popRef, onEscape]);
}
