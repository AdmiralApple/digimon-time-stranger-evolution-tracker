// Crossing-reduction for the compacted focus view.
//
// A focused lineage, laid out in bands, is a layered graph: one band per
// generation, members ordered within each band. Reducing the number of link
// crossings the user sees is the ordering phase of Sugiyama layered layout —
// hold the bands fixed and permute members within each to cut crossings.
//
// This module is pure geometry/combinatorics (no Cytoscape), so it is unit
// tested directly; `viewport.compactFocus` consumes the ordering it returns and
// places the nodes using the same two pitch constants exported here.

import type { Pt } from './orient';

/** Member pitch within a compacted band (vs the full graph's ~104). */
export const FOCUS_PITCH = 88;
/** Gap between consecutive compacted stage bands (vs the full graph's 460). */
export const FOCUS_BAND_PITCH = 210;

/** Compacted-focus position of a member at index `i` of an `n`-member band. */
export const focusPos = (bandIndex: number, i: number, n: number): Pt => ({
  x: bandIndex * FOCUS_BAND_PITCH,
  y: (i - (n - 1) / 2) * FOCUS_PITCH,
});

/**
 * Number of visible link crossings: each edge is a straight segment between two
 * placed nodes; count pairs that properly straddle each other and share no
 * endpoint (edges that merely meet at a node don't cross). Lineages are tiny, so
 * the O(E²) sweep is negligible.
 */
export function countCrossings(
  edges: Array<readonly [string, string]>,
  pos: ReadonlyMap<string, Pt>,
): number {
  const side = (p: Pt, q: Pt, r: Pt) =>
    Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  let n = 0;
  for (let i = 0; i < edges.length; i++) {
    const [af, at] = edges[i];
    const a1 = pos.get(af)!;
    const a2 = pos.get(at)!;
    for (let j = i + 1; j < edges.length; j++) {
      const [bf, bt] = edges[j];
      if (af === bf || af === bt || at === bf || at === bt) continue;
      const b1 = pos.get(bf)!;
      const b2 = pos.get(bt)!;
      const o1 = side(a1, a2, b1);
      const o2 = side(a1, a2, b2);
      const o3 = side(b1, b2, a1);
      const o4 = side(b1, b2, a2);
      if (o1 !== o2 && o3 !== o4 && o1 && o2 && o3 && o4) n++;
    }
  }
  return n;
}

/**
 * Order each band's members to minimise visible link crossings.
 *
 * Alternating barycentre sweeps drift every node toward the mean height of its
 * neighbours on the already-settled side of the sweep; each full pass is scored
 * by {@link countCrossings} and the best-scoring order is kept. The incoming
 * order is both the seed and the baseline, so an already-clean lineage is
 * returned untouched and the result is never worse than the seed.
 *
 * `bands` maps a generation coordinate to its members in seed order; `genOf`
 * returns a slug's generation coordinate. Returns the same keys, re-sequenced.
 */
export function minimizeBandCrossings(
  gens: number[],
  bands: ReadonlyMap<number, string[]>,
  edges: Array<readonly [string, string]>,
  genOf: (slug: string) => number,
): Map<number, string[]> {
  const bandIndex = new Map<number, number>(gens.map((g, i): [number, number] => [g, i]));
  const order = new Map<number, string[]>(
    gens.map((g): [number, string[]] => [g, [...bands.get(g)!]]),
  );

  // Undirected neighbours, restricted to edges whose ends are both placed.
  const placed = new Set(gens.flatMap((g) => bands.get(g)!));
  const live = edges.filter(([f, t]) => placed.has(f) && placed.has(t));
  const nbrs = new Map<string, string[]>();
  for (const [f, t] of live) {
    (nbrs.get(f) ?? nbrs.set(f, []).get(f)!).push(t);
    (nbrs.get(t) ?? nbrs.set(t, []).get(t)!).push(f);
  }

  // Current geometry, rebuilt as bands are reordered, in the exact compacted
  // space so barycentres and the crossing score agree with what's drawn.
  const positions = (): Map<string, Pt> => {
    const pos = new Map<string, Pt>();
    for (const g of gens) {
      const arr = order.get(g)!;
      arr.forEach((s, i) => pos.set(s, focusPos(bandIndex.get(g)!, i, arr.length)));
    }
    return pos;
  };

  // Barycentre over neighbours on the fixed side of the current sweep only.
  const barycentre = (slug: string, downward: boolean, pos: Map<string, Pt>): number => {
    const k = bandIndex.get(genOf(slug))!;
    const fixed = (nbrs.get(slug) ?? []).filter((nb) => {
      const nk = bandIndex.get(genOf(nb))!;
      return downward ? nk < k : nk > k;
    });
    if (!fixed.length) return pos.get(slug)!.y;
    return fixed.reduce((s, nb) => s + pos.get(nb)!.y, 0) / fixed.length;
  };

  const snapshot = () =>
    new Map<number, string[]>(gens.map((g): [number, string[]] => [g, [...order.get(g)!]]));
  let best = snapshot();
  let bestCount = countCrossings(live, positions());

  const sweep = (downward: boolean) => {
    for (const g of downward ? gens : [...gens].reverse()) {
      const pos = positions();
      const seq = order
        .get(g)!
        .map((s, i) => ({ s, b: barycentre(s, downward, pos), i }))
        .sort((p, q) => p.b - q.b || p.i - q.i)
        .map((e) => e.s);
      order.set(g, seq);
    }
  };

  for (let iter = 0; iter < 8 && bestCount > 0; iter++) {
    sweep(true);
    sweep(false);
    const count = countCrossings(live, positions());
    if (count < bestCount) {
      bestCount = count;
      best = snapshot();
    }
  }
  return best;
}
