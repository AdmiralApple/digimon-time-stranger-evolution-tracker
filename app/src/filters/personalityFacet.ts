import { AGENT_SKILL_CATEGORIES, PERSONALITY_CATEGORY } from '../data/agentSkills';
import { PERSONALITY_KEYS, type AgentSkillCategory, type Personality } from '../data/schema';

/**
 * The base-personality filter facet, shared by the Tree's Personality popover and
 * the Field Guide's advanced filters — one definition so both surfaces read
 * identically. The 16 personalities are grouped under their four Agent-Skill
 * bonds (Valor / Amicability / Wisdom / Philanthropy): the same grouping that
 * governs which bond eases a Digimon's evolution, so a bond is a meaningful
 * filter in its own right, not just a folder. Derived from the single source of
 * truth in agentSkills.ts (PERSONALITY_CATEGORY) so the two can never drift.
 */
export interface PersonalityGroup {
  category: AgentSkillCategory;
  personalities: Personality[];
}

/** Bonds in display order (AGENT_SKILL_CATEGORIES), personalities within each in
 *  canonical order (PERSONALITY_KEYS / schema's four-block ordering). */
export const PERSONALITY_GROUPS: readonly PersonalityGroup[] = AGENT_SKILL_CATEGORIES.map(
  (category) => ({
    category,
    personalities: PERSONALITY_KEYS.filter((p) => PERSONALITY_CATEGORY[p] === category),
  }),
);

export type BondSelection = 'none' | 'some' | 'all';

/** How much of a bond's four personalities the current selection covers. */
export function bondSelection(
  selected: ReadonlySet<Personality>,
  group: PersonalityGroup,
): BondSelection {
  const n = group.personalities.reduce((acc, p) => acc + (selected.has(p) ? 1 : 0), 0);
  if (n === 0) return 'none';
  if (n === group.personalities.length) return 'all';
  return 'some';
}

/** Toggle a whole bond: select all four when not already all-selected, else clear
 *  all four. Returns a fresh set (never mutates the input). */
export function toggleBond(
  selected: ReadonlySet<Personality>,
  group: PersonalityGroup,
): Set<Personality> {
  const next = new Set(selected);
  const selectAll = bondSelection(selected, group) !== 'all';
  for (const p of group.personalities) {
    if (selectAll) next.add(p);
    else next.delete(p);
  }
  return next;
}
