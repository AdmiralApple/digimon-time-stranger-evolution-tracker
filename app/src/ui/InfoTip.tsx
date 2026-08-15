import { useEffect, useId, useRef, type ReactNode } from 'react';
import styles from './InfoTip.module.css';

/**
 * A small "?" help affordance with an on-demand explanation. Uses the native
 * Popover API so the bubble sits in the top layer — never clipped by the detail
 * panel's own scroll container — with built-in light-dismiss and Escape. We
 * position it under the trigger and close it on scroll/resize so it can't detach
 * from the "?". Works on pointer, keyboard, and touch (click toggles).
 */
export function InfoTip({
  label,
  children,
  action,
}: {
  label: string;
  children: ReactNode;
  /** Optional call-to-action rendered at the foot of the bubble; picking it
   *  closes the tip first, then runs `onClick` (so two overlays never stack). */
  action?: { label: string; onClick: () => void };
}) {
  const id = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const pop = popRef.current;
    const btn = btnRef.current;
    if (!pop || !btn) return;

    const place = () => {
      const r = btn.getBoundingClientRect();
      // Right-align to the trigger, clamp into the viewport with an 8px margin.
      const left = Math.max(8, Math.min(r.right - pop.offsetWidth, window.innerWidth - pop.offsetWidth - 8));
      const top = Math.min(r.bottom + 6, window.innerHeight - pop.offsetHeight - 8);
      pop.style.left = `${left}px`;
      pop.style.top = `${top}px`;
    };
    const close = () => pop.hidePopover();
    const onToggle = (e: Event) => {
      if ((e as ToggleEvent).newState === 'open') {
        place();
        window.addEventListener('scroll', close, true);
        window.addEventListener('resize', close);
      } else {
        window.removeEventListener('scroll', close, true);
        window.removeEventListener('resize', close);
      }
    };
    pop.addEventListener('toggle', onToggle);
    return () => {
      pop.removeEventListener('toggle', onToggle);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, []);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={styles.trigger}
        popoverTarget={id}
        aria-label={label}
        aria-describedby={id}
      >
        <span aria-hidden="true">?</span>
      </button>
      <div ref={popRef} id={id} popover="auto" role="tooltip" className={styles.pop}>
        {children}
        {action && (
          <button
            type="button"
            className={styles.action}
            onClick={() => {
              popRef.current?.hidePopover();
              action.onClick();
            }}
          >
            {action.label}
            <span aria-hidden="true">→</span>
          </button>
        )}
      </div>
    </>
  );
}
