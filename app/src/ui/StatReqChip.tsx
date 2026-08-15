import type { ReactNode } from 'react';
import { Chip } from './Chip';
import styles from './StatReqChip.module.css';

interface StatReqChipProps {
  /** Stat key (HP, ATK, …) or any short requirement label. */
  label: ReactNode;
  base: number;
  /** Reduced threshold; equal to `base` when no reduction applies. */
  reduced: number;
}

/**
 * One "STAT ≥ value" requirement chip. When an Agent-Skill reduction applies,
 * the chip tints to the --bond hue and reads `base → reduced`: a quiet greyed
 * base, an arrow that carries the "reduced to" meaning, then the reduced value
 * in bold. The arrow separates the two numbers so they never blur together, and
 * the base is never lost — colour is never the sole channel.
 */
export function StatReqChip({ label, base, reduced }: StatReqChipProps) {
  if (reduced >= base) {
    return (
      <Chip>
        {label} ≥ {base}
      </Chip>
    );
  }
  return (
    <Chip color="var(--bond)" title={`Base ${base}, reduced to ${reduced}`}>
      {label} ≥ <span className={styles.was}>{base}</span>
      <span className={styles.arrow} aria-hidden="true">→</span>
      <span className={styles.now}>{reduced}</span>
    </Chip>
  );
}
