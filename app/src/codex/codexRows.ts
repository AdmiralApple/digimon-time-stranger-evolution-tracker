import type {
  Attribute,
  DigimonDatabase,
  Element,
  Generation,
  Personality,
  ResistanceMultiplier,
  StatKey,
  StatLevel,
} from '../data/schema';
import { ATTRIBUTE_KEYS, GENERATION_KEYS, STAT_KEYS } from '../data/schema';
import { classifyAttackType } from '../data/skills';
import { digimonTraits, type SpecialFacet } from '../data/search';
import type { SpecialSkillTag } from './codexFilter';

/** A flat, presentation-ready row for the Codex table — stats pre-summed, plus
 *  the fields the advanced filters (codexFilter) read: this Digimon's special
 *  skills tagged with element + attack type, and its elemental resistance map.
 *  Precomputed once (buildCodexRows) so re-filtering per keystroke stays cheap. */
export interface CodexRow {
  slug: string;
  number: number;
  name: string;
  generation: Generation;
  attribute: Attribute;
  stats: Record<StatLevel, Record<StatKey, number>>;
  total: Record<StatLevel, number>;
  specialSkills: readonly SpecialSkillTag[];
  elementalResistances: Record<Element, ResistanceMultiplier>;
  /** Special "trait" facets this Digimon satisfies (item / jogress / bond / ridable). */
  traits: ReadonlySet<SpecialFacet>;
  basePersonality: Personality;
}

export type SortKey = 'number' | 'name' | 'generation' | 'attribute' | 'total' | StatKey;

/** Non-numeric columns sort ascending by default; power columns sort strongest-first. */
export function defaultDir(key: SortKey): 'asc' | 'desc' {
  return key === 'number' || key === 'name' || key === 'generation' || key === 'attribute'
    ? 'asc'
    : 'desc';
}

export function buildCodexRows(db: DigimonDatabase): CodexRow[] {
  return Object.values(db.digimon)
    .map((d): CodexRow => {
      const lv1 = {} as Record<StatKey, number>;
      const lv99 = {} as Record<StatKey, number>;
      let total1 = 0;
      let total99 = 0;
      for (const key of STAT_KEYS) {
        lv1[key] = d.stats[key].lv1;
        lv99[key] = d.stats[key].lv99;
        total1 += lv1[key];
        total99 += lv99[key];
      }
      const specialSkills = d.specialSkills.map(
        (skill): SpecialSkillTag => ({
          element: skill.element,
          type: classifyAttackType(skill.description),
        }),
      );
      return {
        slug: d.slug,
        number: d.number,
        name: d.name,
        generation: d.generation,
        attribute: d.attribute,
        stats: { lv1, lv99 },
        total: { lv1: total1, lv99: total99 },
        specialSkills,
        elementalResistances: d.elementalResistances,
        traits: digimonTraits(d),
        basePersonality: d.basePersonality,
      };
    })
    .sort((a, b) => a.number - b.number);
}

/** The largest stat total across all rows at a level — the total bar's ceiling. */
export function maxTotal(rows: CodexRow[], level: StatLevel): number {
  return rows.reduce((max, r) => Math.max(max, r.total[level]), 1);
}

/** The smallest stat total across all rows at a level — the total bar's floor.
 *  The bar normalizes min→max so it spreads at each level; a fixed floor only
 *  suits one level (Lv.1 and Lv.99 totals live in very different ranges). */
export function minTotal(rows: CodexRow[], level: StatLevel): number {
  return rows.reduce((min, r) => Math.min(min, r.total[level]), Infinity);
}

const GEN_ORDER = new Map(GENERATION_KEYS.map((g, i) => [g, i]));
const ATTR_ORDER = new Map(ATTRIBUTE_KEYS.map((a, i) => [a, i]));

/**
 * Compare two rows on the active column, at the active level, in direction `dir`
 * (1 asc, -1 desc). Generation and attribute sort by their canonical game order
 * (not alphabetically). `dir` applies to the active column only; ties always
 * fall back to ascending dex number, so equal-value rows keep a stable order
 * whichever way the column is sorted.
 */
export function compareRows(
  a: CodexRow,
  b: CodexRow,
  key: SortKey,
  level: StatLevel,
  dir: 1 | -1 = 1,
): number {
  let delta: number;
  switch (key) {
    case 'number':
      delta = a.number - b.number;
      break;
    case 'name':
      delta = a.name.localeCompare(b.name);
      break;
    case 'generation':
      delta = (GEN_ORDER.get(a.generation) ?? 0) - (GEN_ORDER.get(b.generation) ?? 0);
      break;
    case 'attribute':
      delta = (ATTR_ORDER.get(a.attribute) ?? 0) - (ATTR_ORDER.get(b.attribute) ?? 0);
      break;
    case 'total':
      delta = a.total[level] - b.total[level];
      break;
    default:
      delta = a.stats[level][key] - b.stats[level][key];
  }
  return delta !== 0 ? delta * dir : a.number - b.number;
}
