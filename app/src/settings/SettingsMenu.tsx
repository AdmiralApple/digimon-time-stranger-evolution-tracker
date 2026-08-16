import { useCallback, useRef } from 'react';
import { useStore } from '../state/store';
import type { Orientation } from '../graph/orient';
import type { GraphOrder } from '../graph/order';
import {
  AGENT_SKILL_CATEGORIES,
  MAX_STACKS,
  reductionPct,
} from '../data/agentSkills';
import { useAnchoredPopover } from '../ui/useAnchoredPopover';
import styles from './SettingsMenu.module.css';

function GearIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.09a2 2 0 0 1 1 1.74v.5a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

interface Choice<T> {
  value: T;
  label: string;
}

function Segmented<T extends string | boolean>({
  label,
  hint,
  value,
  choices,
  onChange,
}: {
  label: string;
  hint?: string;
  value: T;
  choices: Choice<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <div className={styles.seg} role="group" aria-label={label}>
        {choices.map((c) => (
          <button
            key={String(c.value)}
            className={c.value === value ? styles.segActive : styles.segBtn}
            aria-pressed={c.value === value}
            onClick={() => onChange(c.value)}
          >
            {c.label}
          </button>
        ))}
      </div>
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}

/** Compact −/value/+ stepper for a 0..max integer (the Agent-Skill stack counts). */
function Stepper({
  value,
  max,
  onChange,
  ariaLabel,
}: {
  value: number;
  max: number;
  onChange: (value: number) => void;
  ariaLabel: string;
}) {
  return (
    <div className={styles.stepper}>
      <button
        type="button"
        className={styles.stepBtn}
        onClick={() => onChange(value - 1)}
        disabled={value <= 0}
        aria-label={`${ariaLabel}: decrease`}
      >
        −
      </button>
      <span className={styles.stepValue} aria-label={`${ariaLabel}: ${value} of ${max}`}>
        {value}
      </span>
      <button
        type="button"
        className={styles.stepBtn}
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label={`${ariaLabel}: increase`}
      >
        +
      </button>
    </div>
  );
}

/** The four Bond Agent Skills — stack counts feed the reduced-requirement preview. */
function AgentSkillsSection() {
  const agentSkills = useStore((s) => s.agentSkills);
  const setAgentSkill = useStore((s) => s.setAgentSkill);

  return (
    <div className={styles.skills}>
      <span className={styles.fieldLabel}>Agent Skills</span>
      <span className={styles.hint}>
        Stacks of each “Digivolution” skill (0–{MAX_STACKS}). Each stack cuts the stat requirements
        of matching-personality evolutions by {reductionPct(1)}%.
      </span>
      <div className={styles.skillRows}>
        {AGENT_SKILL_CATEGORIES.map((category) => {
          const stacks = agentSkills[category];
          return (
            <div className={styles.skillRow} key={category}>
              <span className={styles.skillName}>{category}</span>
              <Stepper
                value={stacks}
                max={MAX_STACKS}
                onChange={(v) => setAgentSkill(category, v)}
                ariaLabel={`Digivolution of ${category}`}
              />
              <span className={stacks > 0 ? styles.skillPctOn : styles.skillPct}>
                {stacks > 0 ? `−${reductionPct(stacks)}%` : '—'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Settings popover — display preferences plus the owned Agent-Skill stacks. */
export function SettingsMenu() {
  const open = useStore((s) => s.settingsOpen);
  const setOpen = useStore((s) => s.setSettingsOpen);
  const orientation = useStore((s) => s.orientation);
  const setOrientation = useStore((s) => s.setOrientation);
  const graphOrder = useStore((s) => s.graphOrder);
  const setGraphOrder = useStore((s) => s.setGraphOrder);
  const hideOthers = useStore((s) => s.hideOthers);
  const setHideOthers = useStore((s) => s.setHideOthers);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // Anchor the menu under the gear. It renders in the top layer (see the manual
  // popover below), so it clears the mobile bottom-sheet's stacking context —
  // which means we position it ourselves rather than relative to the trigger.
  const place = useCallback(() => {
    const btn = triggerRef.current;
    const pop = popRef.current;
    if (!btn || !pop) return;
    const r = btn.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.right - pop.offsetWidth, window.innerWidth - pop.offsetWidth - 8));
    pop.style.left = `${left}px`;
    pop.style.top = `${r.bottom + 8}px`;
  }, []);

  // Drive the popover + its dismiss wiring (shared with the other top-layer
  // popovers). The menu can also be opened from elsewhere (the detail panel's
  // "Open settings" tip), and always paints above the panel / mobile sheet.
  useAnchoredPopover({ open, setOpen, wrapRef, popRef, place });

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        ref={triggerRef}
        className={open ? `${styles.trigger} ${styles.triggerOpen}` : styles.trigger}
        onClick={() => setOpen(!open)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Settings"
        title="Settings"
      >
        <span className={styles.icon} aria-hidden="true">
          <GearIcon />
        </span>
      </button>
      <div ref={popRef} popover="manual" className={styles.pop}>
        <Segmented<Orientation>
          label="Layout"
          hint="Rows spreads members sideways; columns suits portrait screens."
          value={orientation}
          choices={[
            { value: 'rows', label: 'Rows' },
            { value: 'columns', label: 'Columns' },
          ]}
          onChange={setOrientation}
        />
        <Segmented<GraphOrder>
          label="Node order"
          hint="Connections centers immediate forms around your selection. Name and ID sort within each generation."
          value={graphOrder}
          choices={[
            { value: 'connections', label: 'Links' },
            { value: 'original', label: 'Base' },
            { value: 'name', label: 'Name' },
            { value: 'number', label: 'ID' },
          ]}
          onChange={setGraphOrder}
        />
        <Segmented<boolean>
          label="Focus & route"
          hint="How the rest of the tree behaves while a lineage is focused or a route is shown."
          value={hideOthers}
          choices={[
            { value: true, label: 'Hide others' },
            { value: false, label: 'Dim others' },
          ]}
          onChange={setHideOthers}
        />
        <AgentSkillsSection />
        <p className={styles.legal}>
          Unofficial fan project. Not affiliated with or endorsed by Bandai Namco Entertainment.
          Game content belongs to its respective rights holders.{' '}
          <a
            href="https://github.com/AdmiralApple/digimon-time-stranger-evolution-tracker"
            target="_blank"
            rel="noreferrer"
          >
            Source &amp; licenses
          </a>
        </p>
      </div>
    </div>
  );
}
