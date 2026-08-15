import { useCallback, useId, useRef, useState } from 'react';
import { AGENT_SKILL_GLYPH } from '../data/agentSkills';
import { useStore } from '../state/store';
import { PersonalityGroups, personalitySummary } from '../ui/PersonalityGroups';
import { useAnchoredPopover } from '../ui/useAnchoredPopover';
import { toggleBond } from './personalityFacet';
import styles from './PersonalityFilter.module.css';

/**
 * The Tree's base-personality filter. All 16 personalities (four per bond) would
 * make the wrap-flow filter bar several rows tall on a phone, so they live behind
 * one compact trigger that opens a popover grouping them under their bonds — the
 * bar stays a single row, the full facet is one tap away.
 *
 * The popover is a native top-layer [popover] positioned under its trigger (the
 * house pattern — see DESIGN.md's Top-Layer Popover Rule and SettingsMenu): it
 * clears the graph / panel stacking context, and its Escape is captured so it
 * closes without also unwinding lineage focus or the route via the global key
 * handler.
 */
export function PersonalityFilter() {
  const personalities = useStore((s) => s.personalities);
  const togglePersonality = useStore((s) => s.togglePersonality);
  const setPersonalities = useStore((s) => s.setPersonalities);

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const popId = useId();

  const active = personalities.size > 0;
  const summary = personalitySummary(personalities);

  const place = useCallback(() => {
    const btn = triggerRef.current;
    const pop = popRef.current;
    if (!btn || !pop) return;
    const r = btn.getBoundingClientRect();
    const top = r.bottom + 8;
    const left = Math.max(
      8,
      Math.min(r.left, window.innerWidth - pop.offsetWidth - 8),
    );
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
    // Cap the height to whatever room is below the trigger and scroll within —
    // the trigger can sit low (on mobile the filter bar wraps and pushes it
    // down), so a fixed 100dvh-based ceiling would run off the bottom edge.
    pop.style.maxHeight = `${Math.max(180, window.innerHeight - top - 8)}px`;
  }, []);

  // Return focus to the trigger when Escape closes the popover.
  const focusTrigger = useCallback(() => triggerRef.current?.focus(), []);
  useAnchoredPopover({ open, setOpen, wrapRef, popRef, place, onEscape: focusTrigger });

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className={active ? `${styles.trigger} ${styles.triggerActive}` : styles.trigger}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={popId}
        aria-label={`Filter by base personality: ${summary}`}
        onClick={() => setOpen((o) => !o)}
      >
        {active && (
          <span className={styles.glyph} aria-hidden="true">
            {AGENT_SKILL_GLYPH}
          </span>
        )}
        <span className={styles.summary}>{summary}</span>
        <span className={styles.chevron} aria-hidden="true">
          ▾
        </span>
      </button>

      <div ref={popRef} id={popId} popover="manual" className={styles.pop}>
        <div className={styles.head}>
          <span className="label">Base personality</span>
          {/* Always mounted (only its visibility toggles) so the header row keeps a
              constant height — mounting it on demand would grow the row and nudge
              every group below it down. */}
          <button
            type="button"
            className={styles.clear}
            data-hidden={!active}
            aria-hidden={!active}
            tabIndex={active ? undefined : -1}
            disabled={!active}
            onClick={() => setPersonalities(new Set())}
          >
            Clear
          </button>
        </div>
        <PersonalityGroups
          selected={personalities}
          onToggle={togglePersonality}
          onToggleBond={(group) => setPersonalities(toggleBond(personalities, group))}
        />
      </div>
    </div>
  );
}
