// The four Bond Agent Skills — "Digivolution of Valor / Amicability / Wisdom /
// Philanthropy" — each reduce the STAT requirements of every evolution governed
// by their bond, i.e. where the *target's* base personality belongs to that
// bond, when the source Digimon's current personality is matched to the target's
// (personality is convertible, so the app already frames base personality as
// "match this on the source to ease the requirements").
//
// Each owned stack is −20%, capped at 4 stacks / −80%. Agent rank, Agent-Skill
// and Jogress requirements are never reduced — only stat thresholds. Reductions
// round DOWN (the player-friendly reading; a requirement never rounds up).
//
// Pure and dependency-light like the rest of src/data/. The personality→bond
// grouping mirrors schema.ts's own four-block ordering of the 16 personalities.

import type { AgentSkillCategory, Personality, StatKey } from './schema';
import type { RouteStep } from './route';
import type { DigimonDatabase } from './schema';

/** Display + input order for the four bonds (matches the Settings section). */
export const AGENT_SKILL_CATEGORIES: readonly AgentSkillCategory[] = [
  'Valor',
  'Amicability',
  'Wisdom',
  'Philanthropy',
];

/** Bond glyph (shared with the --bond domain accent) — pairs the hue with a mark. */
export const AGENT_SKILL_GLYPH = '❖';

export const MAX_STACKS = 4;
export const PCT_PER_STACK = 20;

/** Which bond owns each of the 16 personalities (schema.ts's four blocks of four). */
export const PERSONALITY_CATEGORY: Record<Personality, AgentSkillCategory> = {
  // Valor — courage
  Zealous: 'Valor',
  Brave: 'Valor',
  Reckless: 'Valor',
  Daring: 'Valor',
  // Wisdom — intellect
  Enlightened: 'Wisdom',
  Sly: 'Wisdom',
  Astute: 'Wisdom',
  Strategic: 'Wisdom',
  // Philanthropy — devotion
  Adoring: 'Philanthropy',
  Devoted: 'Philanthropy',
  Tolerant: 'Philanthropy',
  Overprotective: 'Philanthropy',
  // Amicability — sociability
  Opportunistic: 'Amicability',
  Friendly: 'Amicability',
  Sociable: 'Amicability',
  Compassionate: 'Amicability',
};

/** The player's owned stacks per bond, 0..4 each. Persisted with display prefs. */
export type AgentSkillStacks = Record<AgentSkillCategory, number>;

export const EMPTY_AGENT_SKILLS: AgentSkillStacks = {
  Valor: 0,
  Amicability: 0,
  Wisdom: 0,
  Philanthropy: 0,
};

/** Coerce arbitrary input to a whole number of stacks in [0, MAX_STACKS]. */
export function clampStacks(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(MAX_STACKS, Math.trunc(n)));
}

/** Whole-number percentage reduced (0, 20, 40, 60, 80). */
export function reductionPct(stacks: number): number {
  return clampStacks(stacks) * PCT_PER_STACK;
}

/**
 * Reduced threshold for one stat. Integer math (value·kept/100, then floored) so
 * a value landing on a whole number never slips a unit through float rounding.
 * Rounds down, per the confirmed rule for this tool.
 */
export function reduceStat(value: number, stacks: number): number {
  const kept = 100 - reductionPct(stacks);
  if (kept === 100) return value;
  return Math.floor((value * kept) / 100);
}

/** Stacks that apply to an evolution INTO a Digimon with this base personality. */
export function stacksForPersonality(base: Personality, stacks: AgentSkillStacks): number {
  return clampStacks(stacks[PERSONALITY_CATEGORY[base]] ?? 0);
}

/** True when the player owns at least one stack in any bond. */
export function hasAnyStacks(stacks: AgentSkillStacks): boolean {
  return AGENT_SKILL_CATEGORIES.some((c) => clampStacks(stacks[c]) > 0);
}

/**
 * Clone a route's forward steps with their stat thresholds reduced by the
 * player's stacks for each step's *target* bond. De-digivolve steps and steps
 * whose bond has no stacks pass through unchanged (identity-preserving, so the
 * summary fold can compare base vs reduced ceilings).
 */
export function reduceRouteSteps(
  steps: RouteStep[],
  db: DigimonDatabase,
  stacks: AgentSkillStacks,
): RouteStep[] {
  return steps.map((step) => {
    if (step.kind !== 'digivolve' || !step.requirement) return step;
    const n = stacksForPersonality(db.digimon[step.to].basePersonality, stacks);
    if (n === 0) return step;
    const reduced: Partial<Record<StatKey, number>> = {};
    for (const [key, value] of Object.entries(step.requirement.stats)) {
      reduced[key as StatKey] = reduceStat(value!, n);
    }
    return { ...step, requirement: { ...step.requirement, stats: reduced } };
  });
}
