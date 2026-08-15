import type { Personality } from '../data/schema';
import { AGENT_SKILL_GLYPH, reductionPct } from '../data/agentSkills';
import styles from './ReductionNote.module.css';

/**
 * The one-line explanation that sits under a set of reduced stat chips: how much
 * the requirements drop and the personality the source must be converted to for
 * it to hold. Shown only when a reduction is in effect.
 */
export function ReductionNote({
  stacks,
  personality,
}: {
  stacks: number;
  personality: Personality;
}) {
  return (
    <p className={styles.note}>
      <span className={styles.glyph} aria-hidden="true">
        {AGENT_SKILL_GLYPH}
      </span>
      Stats shown −{reductionPct(stacks)}% when digivolving from a {personality} Digimon.
    </p>
  );
}
