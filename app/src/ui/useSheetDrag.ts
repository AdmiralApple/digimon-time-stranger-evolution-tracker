import { useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';

const TOGGLE_PX = 64; // drag past this (in the collapse/expand direction) to switch state
const TAP_PX = 6; // below this the gesture is a tap, handled by onClick

/**
 * Drag-to-minimise for the mobile bottom sheet. Attach the returned handlers to
 * the grab handle. Dragging the sheet down past a threshold *collapses* it to a
 * peek strip at the bottom (keeping the selection / route alive); dragging back
 * up — or tapping the handle — restores it. Dismissing outright is a separate,
 * explicit action (the ✕ button), never the drag: that's what stops the sheet
 * from silently tearing down the route/selection when you only meant to peek at
 * the graph behind it.
 *
 * Positions are written straight to the DOM during the drag (no per-frame React
 * render); the class-driven CSS transition is suspended for the duration and
 * restored on release so the settle animates. `peekPx` must match the CSS
 * `--sheet-peek` height so the collapsed baseline lines up with the class state.
 */
export function useSheetDrag<T extends HTMLElement>(
  hostRef: RefObject<T | null>,
  {
    enabled,
    collapsed,
    onCollapse,
    onExpand,
    peekPx,
  }: {
    enabled: boolean;
    collapsed: boolean;
    onCollapse: () => void;
    onExpand: () => void;
    peekPx: number;
  },
) {
  const drag = useRef({ active: false, startY: 0, dy: 0 });
  const suppressClick = useRef(false);

  const collapsedOffset = (host: T) => Math.max(0, host.offsetHeight - peekPx);

  const onPointerDown = (event: ReactPointerEvent) => {
    if (!enabled) return;
    const host = hostRef.current;
    if (!host) return;
    drag.current = { active: true, startY: event.clientY, dy: 0 };
    suppressClick.current = false;
    host.style.transition = 'none';
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent) => {
    const d = drag.current;
    if (!d.active) return;
    const host = hostRef.current;
    if (!host) return;
    d.dy = event.clientY - d.startY;
    // Follow the finger from the current state's baseline, clamped between fully
    // open (0) and the collapsed peek offset.
    const base = collapsed ? collapsedOffset(host) : 0;
    const next = Math.min(collapsedOffset(host), Math.max(0, base + d.dy));
    host.style.transform = `translateY(${next}px)`;
  };

  const finish = () => {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    const host = hostRef.current;
    if (!host) return;
    host.style.transition = ''; // hand animation back to CSS
    const offset = collapsedOffset(host);

    if (Math.abs(d.dy) <= TAP_PX) {
      host.style.transform = ''; // a tap — let onClick toggle the state
      return;
    }
    suppressClick.current = true; // a deliberate drag, not a tap

    if (!collapsed && d.dy > TOGGLE_PX) {
      // Settle to the collapsed baseline (matches the data-collapsed CSS), then
      // flip state so the class takes over without a jump.
      host.style.transform = `translateY(${offset}px)`;
      onCollapse();
    } else if (collapsed && d.dy < -TOGGLE_PX) {
      host.style.transform = 'translateY(0px)';
      onExpand();
    } else {
      // Not far enough — spring back to the current state.
      host.style.transform = collapsed ? `translateY(${offset}px)` : 'translateY(0px)';
    }
  };

  const onClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (collapsed) onExpand();
    else onCollapse();
  };

  return { onPointerDown, onPointerMove, onPointerUp: finish, onPointerCancel: finish, onClick };
}
