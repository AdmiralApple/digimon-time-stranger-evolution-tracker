// Advanced Codex facets — special skill (element + attack type) and elemental
// resistance. Pure and dependency-free (schema types only) so the whole thing
// is unit-testable and re-usable, mirroring the src/data/ layer's discipline.
//
// Semantics differ per facet, by design:
//   • Special skill      — two sub-facets, OR within each:
//       – element (Fire…Null): the elemental school of a damaging skill.
//       – skill kind (magic / physical / Buff / Debuff / Recovery): what the skill
//         IS — its attack type when it deals damage, else its effect category.
//     They combine SAME-SKILL: a Digimon matches only if it owns ONE special skill
//     that satisfies both — "Fire + Physical" means an actual Fire physical attack,
//     not a Fire attack plus some unrelated physical one.
//   • Elemental resist   — AND within the facet: each tri-state chip is an
//     independent profile constraint ("resists Fire AND weak to Dark").
// Across facets (and against the basic gen/attribute filters) it stays AND.
//
// Attribute resistance is deliberately NOT a facet: the attribute triangle is
// deterministic (a Digimon's attribute fixes its attribute resistances), so
// filtering by it would merely restate the basic attribute filter.

import { ELEMENT_KEYS, type Element, type Personality, type ResistanceMultiplier } from '../data/schema';
import type { SpecialFacet } from '../data/search';
import type { AttackType } from '../data/skills';

/** Non-elemental categories the dataset stores in a special skill's `element`,
 *  alongside the 11 combat elements. The blank element a few skills carry is
 *  deliberately not offered as a facet. */
export const SKILL_FUNCTIONS = ['Buff', 'Debuff', 'Recovery'] as const;
export type SkillFunction = (typeof SKILL_FUNCTIONS)[number];

/** Element + attack type of one special skill — the unit the facet matches on. */
export interface SpecialSkillTag {
  element: string;
  type: AttackType | null;
}

// Resistance keys stay namespaced (`el:*`) so they're self-describing in the
// resist/weak sets and unambiguous should another resistance kind ever join.
export type ResistKey = `el:${Element}`;
export const elKey = (e: Element): ResistKey => `el:${e}`;

export const ELEMENT_RESIST_KEYS: readonly ResistKey[] = ELEMENT_KEYS.map(elKey);

export type ResistState = 'off' | 'resist' | 'weak';

/** The fields a row must expose for `matchesAdvanced` — a subset of Digimon. */
export interface AdvancedTarget {
  specialSkills: readonly SpecialSkillTag[];
  elementalResistances: Record<Element, ResistanceMultiplier>;
  traits: ReadonlySet<SpecialFacet>;
  basePersonality: Personality;
}

export interface AdvancedCriteria {
  skillElements: ReadonlySet<string>; // combat elements only (Fire…Null)
  // The skill-kind facet: attack types (magic / physical) and the non-damaging
  // effect categories (Buff / Debuff / Recovery), matched against each skill's kind.
  skillTypes: ReadonlySet<string>;
  resist: ReadonlySet<string>;
  weak: ReadonlySet<string>;
  special: ReadonlySet<SpecialFacet>; // trait facets — OR within, like the Tree filter
  personalities: ReadonlySet<Personality>; // base personality — OR within, like the Tree filter
}

export const EMPTY_ADVANCED: AdvancedCriteria = {
  skillElements: new Set(),
  skillTypes: new Set(),
  resist: new Set(),
  weak: new Set(),
  special: new Set(),
  personalities: new Set(),
};

/** Which state a resistance chip is in given the current resist/weak sets. */
export function resistState(
  resist: ReadonlySet<string>,
  weak: ReadonlySet<string>,
  key: ResistKey,
): ResistState {
  if (resist.has(key)) return 'resist';
  if (weak.has(key)) return 'weak';
  return 'off';
}

/** Cycle one resistance chip off → resist → weak → off, returning fresh sets. */
export function cycleResist(
  resist: ReadonlySet<string>,
  weak: ReadonlySet<string>,
  key: ResistKey,
): { resist: Set<string>; weak: Set<string> } {
  const r = new Set(resist);
  const w = new Set(weak);
  const state = resistState(resist, weak, key);
  r.delete(key);
  w.delete(key);
  if (state === 'off') r.add(key); // off → resist
  else if (state === 'resist') w.add(key); // resist → weak
  // weak → off (already removed from both)
  return { resist: r, weak: w };
}

function multiplierFor(t: AdvancedTarget, key: string): ResistanceMultiplier | undefined {
  if (key.startsWith('el:')) return t.elementalResistances[key.slice(3) as Element];
  return undefined;
}

/** A skill's "kind" for the skill-type facet: its attack type (magic / physical)
 *  when it deals damage, else its effect category (Buff / Debuff / Recovery, which
 *  the dataset stores as the element) — the single "what kind of skill is this"
 *  axis the UI groups under "Skill type". */
function skillKind(s: SpecialSkillTag): string {
  return s.type !== null ? s.type : s.element;
}

/** Same-skill match: does the target own one special skill satisfying both the
 *  element and skill-kind sub-facets? Empty sub-facet = no constraint. */
function matchesSpecialSkill(t: AdvancedTarget, c: AdvancedCriteria): boolean {
  if (!c.skillElements.size && !c.skillTypes.size) return true;
  for (const s of t.specialSkills) {
    const elementOk = !c.skillElements.size || c.skillElements.has(s.element);
    const typeOk = !c.skillTypes.size || c.skillTypes.has(skillKind(s));
    if (elementOk && typeOk) return true;
  }
  return false;
}

/** OR within the trait facet (mirrors the Tree filter): the target must hold at
 *  least one selected trait. Empty facet = no constraint. */
function matchesTraits(t: AdvancedTarget, c: AdvancedCriteria): boolean {
  if (!c.special.size) return true;
  for (const facet of c.special) if (t.traits.has(facet)) return true;
  return false;
}

/** OR within the personality facet (mirrors the Tree filter): the target's base
 *  personality must be one of those selected. Empty facet = no constraint. */
function matchesPersonality(t: AdvancedTarget, c: AdvancedCriteria): boolean {
  if (!c.personalities.size) return true;
  return c.personalities.has(t.basePersonality);
}

/** True when the target passes every advanced constraint (empty = passes). */
export function matchesAdvanced(t: AdvancedTarget, c: AdvancedCriteria): boolean {
  if (!matchesSpecialSkill(t, c)) return false;
  if (!matchesTraits(t, c)) return false;
  if (!matchesPersonality(t, c)) return false;
  // Resist = takes reduced damage (×0 immune or ×0.5). Weak = takes extra (×1.5/×2).
  for (const key of c.resist) {
    const m = multiplierFor(t, key);
    if (m === undefined || m >= 1) return false;
  }
  for (const key of c.weak) {
    const m = multiplierFor(t, key);
    if (m === undefined || m <= 1) return false;
  }
  return true;
}

export function hasAdvancedCriteria(c: AdvancedCriteria): boolean {
  return (
    c.skillElements.size > 0 ||
    c.skillTypes.size > 0 ||
    c.resist.size > 0 ||
    c.weak.size > 0 ||
    c.special.size > 0 ||
    c.personalities.size > 0
  );
}

/** Total number of active advanced constraints — drives the collapsed badge. */
export function advancedCount(c: AdvancedCriteria): number {
  return (
    c.skillElements.size +
    c.skillTypes.size +
    c.resist.size +
    c.weak.size +
    c.special.size +
    c.personalities.size
  );
}
