import type { CSSProperties, ReactNode } from 'react';
import styles from './FilterChip.module.css';

/**
 * A labelled facet group (Gen, Attribute, Trait…). Two layouts:
 *  - inline (default): a subdued small-caps label sitting on the same wrapping row
 *    as its chips — the compact form for the Tree bar and the Codex's basic filters.
 *  - block: a full-line `.label` header above a wrapping chip row — used across the
 *    Codex's advanced facets so every section there reads with the same header.
 */
export function FilterChipGroup({
  label,
  children,
  block = false,
}: {
  label: string;
  children: ReactNode;
  block?: boolean;
}) {
  if (block) {
    return (
      <div className={styles.groupBlock}>
        <span className="label">{label}</span>
        <div className={styles.blockChips}>{children}</div>
      </div>
    );
  }
  return (
    <div className={styles.group}>
      <span className={`label ${styles.groupLabel}`}>{label}</span>
      {children}
    </div>
  );
}

/**
 * A pill filter toggle shared by the graph FilterBar and the Codex. Distinct from
 * the display-only ui/Chip badge: this carries pressed state (aria-pressed) and an
 * inactive → active transition. `color` tints the hover / active borders and fill;
 * `dot` adds a leading swatch of that colour (attribute chips).
 */
export function FilterChip({
  active,
  onClick,
  color,
  dot = false,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color?: string;
  dot?: boolean;
  title?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={active ? styles.chipActive : styles.chip}
      style={color ? ({ '--chip-color': color } as CSSProperties) : undefined}
      aria-pressed={active}
      title={title}
      onClick={onClick}
    >
      {dot && color && <span className={styles.dot} style={{ background: color }} />}
      {children}
    </button>
  );
}
