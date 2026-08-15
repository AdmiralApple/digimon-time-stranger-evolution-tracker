import type { JSX } from 'react';
import type { AppView } from '../state/store';
import styles from './ViewSwitch.module.css';

/** Tiny network glyph — three nodes joined by two edges (the evolution graph). */
function TreeIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <path d="M4.5 11.5 L8 8 L11.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="4.5" cy="11.5" r="2.1" fill="currentColor" />
      <circle cx="11.5" cy="4.5" r="2.6" fill="currentColor" />
    </svg>
  );
}

/** Tiny rows glyph — the flat Codex table. */
function CodexIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <path d="M3 4.5 H13" />
        <path d="M3 8 H13" />
        <path d="M3 11.5 H13" />
      </g>
    </svg>
  );
}

const OPTIONS: Array<{ value: AppView; label: string; icon: () => JSX.Element }> = [
  { value: 'graph', label: 'Tree', icon: TreeIcon },
  { value: 'codex', label: 'Field guide', icon: CodexIcon },
];

/**
 * Top-level surface switch: the evolution Tree ⇄ the Codex table. A connected
 * two-segment control (radiogroup semantics) rather than two toggles, so it
 * reads as one exclusive choice.
 */
export function ViewSwitch({
  value,
  onChange,
}: {
  value: AppView;
  onChange: (view: AppView) => void;
}) {
  return (
    <div className={styles.switch} role="radiogroup" aria-label="View">
      {OPTIONS.map(({ value: option, label, icon: Icon }) => {
        const active = value === option;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            className={active ? styles.active : styles.seg}
            onClick={() => onChange(option)}
          >
            <Icon />
            <span className={styles.label}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
