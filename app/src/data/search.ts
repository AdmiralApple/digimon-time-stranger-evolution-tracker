import type { Attribute, Digimon, DigimonDatabase, Generation, Personality } from './schema';

export interface SearchEntry {
  slug: string;
  name: string;
  nameLower: string;
  number: number;
  generation: Generation;
  attribute: Attribute;
}

export interface SearchHit {
  slug: string;
  score: number;
}

export function buildSearchIndex(db: DigimonDatabase): SearchEntry[] {
  return Object.values(db.digimon)
    .sort((a, b) => a.number - b.number)
    .map((d) => ({
      slug: d.slug,
      name: d.name,
      nameLower: d.name.toLowerCase(),
      number: d.number,
      generation: d.generation,
      attribute: d.attribute,
    }));
}

/** Rank: exact > prefix > word-boundary > substring > slug substring; "#123" or bare number = dex lookup. */
export function search(index: SearchEntry[], query: string, limit = 12): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const numMatch = q.match(/^#?(\d{1,3})$/);
  if (numMatch) {
    const n = Number(numMatch[1]);
    return index.filter((e) => e.number === n).map((e) => ({ slug: e.slug, score: 100 }));
  }

  const hits: SearchHit[] = [];
  for (const entry of index) {
    let score: number | null = null;
    if (entry.nameLower === q) score = 100;
    else if (entry.nameLower.startsWith(q)) score = 80;
    else if (entry.nameLower.includes(' ' + q) || entry.nameLower.includes('(' + q)) score = 60;
    else if (entry.nameLower.includes(q)) score = 40;
    else if (entry.slug.includes(q.replace(/\s+/g, '-'))) score = 20;
    if (score !== null) hits.push({ slug: entry.slug, score });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}

export type SpecialFacet = 'item' | 'jogress' | 'bond' | 'ridable';

export interface FilterCriteria {
  generations?: ReadonlySet<Generation>;
  attributes?: ReadonlySet<Attribute>;
  special?: ReadonlySet<SpecialFacet>;
  /** Base personality — OR within (matches any selected), like the other facets. */
  personalities?: ReadonlySet<Personality>;
}

export function hasActiveCriteria(f: FilterCriteria): boolean {
  return Boolean(
    f.generations?.size || f.attributes?.size || f.special?.size || f.personalities?.size,
  );
}

/** The set of special "trait" facets a Digimon satisfies. Single source of truth
 *  for what item / jogress / bond / ridable mean, shared by the Tree filter and
 *  the Field Guide's advanced filters. */
export function digimonTraits(d: Digimon): Set<SpecialFacet> {
  const traits = new Set<SpecialFacet>();
  const cond = d.evolutionCondition;
  if (cond.requiredItem) traits.add('item');
  if (cond.jogressPartners) traits.add('jogress');
  if (cond.agentSkills) traits.add('bond');
  if (d.ridable) traits.add('ridable');
  return traits;
}

// Single-flight memo: a filter toggle fires both graph subscriptions (appearance
// + layout) plus a FilterBar re-render, each calling filterSlugs with the SAME
// criteria — so cache the last (db, facets) → set. The facet Sets keep a stable
// reference between toggles (the store swaps them only on change), so identity
// comparison is enough. Callers only read the result, never mutate it.
let memoKey: readonly unknown[] | null = null;
let memoResult: Set<string> | null = null;

/** OR within a facet, AND across facets. Empty facet = no constraint. */
export function filterSlugs(db: DigimonDatabase, f: FilterCriteria): Set<string> {
  const key = [db, f.generations, f.attributes, f.special, f.personalities] as const;
  if (memoResult && memoKey && key.every((v, i) => v === memoKey![i])) {
    return memoResult;
  }
  const result = new Set<string>();
  for (const d of Object.values(db.digimon)) {
    if (f.generations?.size && !f.generations.has(d.generation)) continue;
    if (f.attributes?.size && !f.attributes.has(d.attribute)) continue;
    if (f.personalities?.size && !f.personalities.has(d.basePersonality)) continue;
    if (f.special?.size) {
      const traits = digimonTraits(d);
      let matches = false;
      for (const facet of f.special) {
        if (traits.has(facet)) {
          matches = true;
          break;
        }
      }
      if (!matches) continue;
    }
    result.add(d.slug);
  }
  memoKey = key;
  memoResult = result;
  return result;
}
