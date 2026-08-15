import { AGENT_SKILL_GLYPH } from '../data/agentSkills';
import type { Personality } from '../data/schema';
import {
  bondSelection,
  PERSONALITY_GROUPS,
  type PersonalityGroup,
} from '../filters/personalityFacet';
import { FilterChip } from './FilterChip';
import styles from './PersonalityGroups.module.css';

/**
 * The base-personality facet, rendered as four bond sections (Valor / Amicability
 * / Wisdom / Philanthropy), each a header that toggles its four personalities at
 * once plus the four individual chips. Shared verbatim by the Tree's Personality
 * popover and the Field Guide's advanced filters, so the two read as one control.
 *
 * The bond is the same one whose Agent Skill eases evolution into these
 * personalities, so it carries the --bond hue and the ❖ glyph everywhere that
 * system appears — colour reinforced by the glyph and the personality name, never
 * standing alone.
 *
 * Layout adapts to the container width (not the viewport), via a container query:
 * a narrow host (the Tree popover) stacks each bond's chips under its header; a
 * wide host (the Field Guide's advanced panel on desktop) lays each bond out as
 * one row — header column + chips — so the horizontal space isn't wasted.
 */
export function PersonalityGroups({
  selected,
  onToggle,
  onToggleBond,
}: {
  selected: ReadonlySet<Personality>;
  onToggle: (personality: Personality) => void;
  onToggleBond: (group: PersonalityGroup) => void;
}) {
  return (
    <div className={styles.root}>
      <div className={styles.groups}>
        {PERSONALITY_GROUPS.map((group) => {
          const sel = bondSelection(selected, group);
          const n = group.personalities.reduce((acc, p) => acc + (selected.has(p) ? 1 : 0), 0);
          return (
            <div className={styles.bond} key={group.category}>
              <button
                type="button"
                className={styles.bondHead}
                data-selection={sel}
                aria-pressed={sel === 'all'}
                aria-label={
                  sel === 'all'
                    ? `Clear all ${group.category} personalities`
                    : `Select all ${group.category} personalities`
                }
                onClick={() => onToggleBond(group)}
              >
                <span className={styles.bondGlyph} aria-hidden="true">
                  {AGENT_SKILL_GLYPH}
                </span>
                <span className={styles.bondName}>{group.category}</span>
                <span className={styles.bondCount} aria-hidden="true">
                  {n > 0 ? `${n}/${group.personalities.length}` : ''}
                </span>
              </button>
              <div className={styles.chips}>
                {group.personalities.map((personality) => (
                  <FilterChip
                    key={personality}
                    active={selected.has(personality)}
                    color="var(--bond)"
                    onClick={() => onToggle(personality)}
                  >
                    {personality}
                  </FilterChip>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** A short summary of the current selection for a collapsed trigger — the bond
 *  name when a whole (single) bond is picked, else "{n} selected". */
export function personalitySummary(selected: ReadonlySet<Personality>): string {
  if (selected.size === 0) return 'Any';
  const fullBonds = PERSONALITY_GROUPS.filter((g) => bondSelection(selected, g) === 'all');
  const covered = fullBonds.reduce((acc, g) => acc + g.personalities.length, 0);
  if (fullBonds.length === 1 && covered === selected.size) return fullBonds[0].category;
  return `${selected.size} selected`;
}
