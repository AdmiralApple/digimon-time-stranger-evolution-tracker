import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { lineage } from '../../data/graph';
import { loadRealGraph } from '../../data/__tests__/fixture';
import { countCrossings, focusPos, minimizeBandCrossings } from '../crossing';
import type { Pt } from '../orient';

// Real app data. Load the committed source (data/digimon.json) via the shared
// fixture — public/digimon.json is gitignored and only exists after data:sync,
// so reading it directly failed on a clean checkout / CI.
const graph = loadRealGraph();
const layout = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../generated/layout.json', import.meta.url)), 'utf8'),
);

/** Reproduce compactFocus's banding: lineage members grouped + seeded by base order. */
function focusBands(focus: string) {
  const lin = lineage(graph, focus);
  const byGen = new Map<number, string[]>();
  for (const slug of lin.nodes) {
    const base = layout.positions[slug];
    if (!base) continue;
    (byGen.get(base.x) ?? byGen.set(base.x, []).get(base.x)!).push(slug);
  }
  const gens = [...byGen.keys()].sort((a, b) => a - b);
  for (const g of gens) {
    byGen.get(g)!.sort((a: string, b: string) => layout.positions[a].y - layout.positions[b].y);
  }
  const live = lin.edges.filter(
    ([f, t]) => layout.positions[f] && layout.positions[t],
  ) as Array<readonly [string, string]>;
  return { gens, byGen, live, genOf: (s: string) => layout.positions[s].x };
}

function place(order: Map<number, string[]>, gens: number[]): Map<string, Pt> {
  const bandIndex = new Map(gens.map((g, i) => [g, i] as const));
  const pos = new Map<string, Pt>();
  for (const g of gens) {
    const arr = order.get(g)!;
    arr.forEach((s, i) => pos.set(s, focusPos(bandIndex.get(g)!, i, arr.length)));
  }
  return pos;
}

describe('minimizeBandCrossings', () => {
  test('untangles a hand-built X-crossing without changing membership', () => {
    // Two bands of two; edges a->d and b->c cross when kept in seed order.
    const bands = new Map<number, string[]>([
      [0, ['a', 'b']],
      [1, ['c', 'd']],
    ]);
    const gens = [0, 1];
    const edges: Array<readonly [string, string]> = [
      ['a', 'd'],
      ['b', 'c'],
    ];
    const genOf = (s: string) => (s === 'a' || s === 'b' ? 0 : 1);
    expect(countCrossings(edges, place(bands, gens))).toBe(1);
    const out = minimizeBandCrossings(gens, bands, edges, genOf);
    expect(countCrossings(edges, place(out, gens))).toBe(0);
    // same members per band, just reordered
    expect([...out.get(0)!].sort()).toEqual(['a', 'b']);
    expect([...out.get(1)!].sort()).toEqual(['c', 'd']);
  });

  test('never regresses vs the seed and reduces crossings across the whole dex', () => {
    let improved = 0;
    let seedTotal = 0;
    let optTotal = 0;
    for (const focus of graph.slugs) {
      const { gens, byGen, live, genOf } = focusBands(focus);
      const seed = new Map<number, string[]>(
        gens.map((g): [number, string[]] => [g, [...byGen.get(g)!]]),
      );
      const opt = minimizeBandCrossings(gens, byGen, live, genOf);

      // membership per band is preserved exactly
      for (const g of gens) {
        expect([...opt.get(g)!].sort()).toEqual([...seed.get(g)!].sort());
      }
      const seedC = countCrossings(live, place(seed, gens));
      const optC = countCrossings(live, place(opt, gens));
      expect(optC).toBeLessThanOrEqual(seedC);
      seedTotal += seedC;
      optTotal += optC;
      if (optC < seedC) improved++;
    }
    // eslint-disable-next-line no-console
    console.log(
      `improved ${improved}/${graph.slugs.length} lineages; ` +
        `crossings ${seedTotal} -> ${optTotal} ` +
        `(${((1 - optTotal / seedTotal) * 100).toFixed(1)}% fewer)`,
    );
    expect(improved).toBeGreaterThan(0);
    expect(optTotal).toBeLessThan(seedTotal);
  });
});
