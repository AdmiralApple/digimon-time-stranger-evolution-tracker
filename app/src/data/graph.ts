import type { DigimonDatabase } from './schema';

export interface EvolutionGraph {
  db: DigimonDatabase;
  /** Stable order: ascending dex number. */
  slugs: readonly string[];
  /** Forward adjacency (evolvesTo). */
  out: ReadonlyMap<string, readonly string[]>;
  /** Reverse adjacency (evolvesFrom). */
  inn: ReadonlyMap<string, readonly string[]>;
}

export function buildGraph(db: DigimonDatabase): EvolutionGraph {
  const slugs = Object.keys(db.digimon).sort(
    (a, b) => db.digimon[a].number - db.digimon[b].number,
  );
  const out = new Map<string, readonly string[]>();
  const inn = new Map<string, readonly string[]>();
  for (const slug of slugs) {
    out.set(slug, db.digimon[slug].evolvesTo);
    inn.set(slug, db.digimon[slug].evolvesFrom);
  }
  return { db, slugs, out, inn };
}

export const edgeKey = (from: string, to: string): string => `${from}->${to}`;

const NO_EXCLUSIONS: ReadonlySet<string> = new Set();

function reach(
  adj: ReadonlyMap<string, readonly string[]>,
  start: string,
  excluded: ReadonlySet<string>,
): Set<string> {
  // Cycle-safe BFS; `start` is excluded from the result even when it is
  // self-reachable through a 2-cycle (e.g. omnimon <-> omnimon-x-antibody).
  // Nodes in `excluded` are treated as if they don't exist: they're never
  // visited and are never traversed *through*, so anything only reachable via
  // an excluded node drops out too (that's what prunes a whole branch).
  const visited = new Set<string>([start]);
  const result = new Set<string>();
  const queue = [start];
  while (queue.length) {
    for (const next of adj.get(queue.shift()!) ?? []) {
      if (excluded.has(next) || visited.has(next)) continue;
      visited.add(next);
      result.add(next);
      queue.push(next);
    }
  }
  return result;
}

/** All nodes that can reach `slug` via forward edges (self excluded). Nodes in
 *  `excluded` — and anything reachable only through them — are pruned. */
export const ancestors = (
  g: EvolutionGraph,
  slug: string,
  excluded: ReadonlySet<string> = NO_EXCLUSIONS,
): Set<string> => reach(g.inn, slug, excluded);

/** All nodes reachable from `slug` via forward edges (self excluded). Nodes in
 *  `excluded` — and anything reachable only through them — are pruned. */
export const descendants = (
  g: EvolutionGraph,
  slug: string,
  excluded: ReadonlySet<string> = NO_EXCLUSIONS,
): Set<string> => reach(g.out, slug, excluded);

export interface Lineage {
  focus: string;
  /** ancestors ∪ {focus} ∪ descendants */
  nodes: Set<string>;
  /** Induced forward edges on `nodes` (includes alternative routes and mode cycles). */
  edges: Array<readonly [string, string]>;
}

export function lineage(
  g: EvolutionGraph,
  slug: string,
  excluded: ReadonlySet<string> = NO_EXCLUSIONS,
): Lineage {
  const nodes = ancestors(g, slug, excluded);
  for (const d of descendants(g, slug, excluded)) nodes.add(d);
  nodes.add(slug); // the focus always stays, even if somehow listed as excluded
  // Induced edges skip anything touching an excluded node for free: excluded
  // nodes never made it into `nodes`, so the membership test below drops them.
  const edges: Array<readonly [string, string]> = [];
  for (const from of nodes) {
    for (const to of g.out.get(from) ?? []) {
      if (nodes.has(to)) edges.push([from, to] as const);
    }
  }
  return { focus: slug, nodes, edges };
}
