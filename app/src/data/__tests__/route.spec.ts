import { describe, expect, it } from 'vitest';
import { buildGraph } from '../graph';
import { DEFAULT_COSTS, classifyForwardEdge, findRoutes, stepRequirement } from '../route';
import { loadRealGraph, makeDb } from './fixture';

describe('route planner (synthetic cost behavior)', () => {
  // ladder: a -> b -> c -> d, shortcut a -> x -> d (x is item-gated)
  const g = buildGraph(makeDb({
    a: { evolvesTo: ['b', 'x'] },
    b: { evolvesTo: ['c'] },
    c: { evolvesTo: ['d'] },
    d: {},
    x: { evolvesTo: ['d'], condition: { requiredItem: 'Test Egg' } },
  }));

  it('hop count dominates plain routes', () => {
    const [best] = findRoutes(g, 'a', 'c');
    expect(best.steps.map((s) => s.to)).toEqual(['b', 'c']);
    expect(best.totalCost).toBe(2 * DEFAULT_COSTS.evolve);
  });

  it('a plain route one hop longer beats an item route', () => {
    // a->x(item 255)->d(105) = 360 vs a->b->c->d = 315
    const [best] = findRoutes(g, 'a', 'd');
    expect(best.steps.map((s) => s.to)).toEqual(['b', 'c', 'd']);
  });

  it('devolve is preferred over evolve on cost ties and is condition-free', () => {
    const [best] = findRoutes(g, 'c', 'a');
    expect(best.steps.every((s) => s.kind === 'dedigivolve')).toBe(true);
    expect(best.steps.every((s) => s.requirement === null)).toBe(true);
    expect(best.totalCost).toBe(2 * DEFAULT_COSTS.devolve);
  });

  it('Infinity surcharge excludes item arcs entirely', () => {
    const routes = findRoutes(g, 'a', 'd', { costs: { itemSurcharge: Infinity } });
    for (const r of routes) {
      expect(r.steps.some((s) => s.class === 'item')).toBe(false);
    }
  });

  it('from === to yields one empty route', () => {
    expect(findRoutes(g, 'a', 'a')).toEqual([{ from: 'a', to: 'a', steps: [], totalCost: 0 }]);
  });

  it('Yen returns distinct loopless alternatives in cost order', () => {
    const routes = findRoutes(g, 'a', 'd', { k: 3 });
    expect(routes.length).toBeGreaterThanOrEqual(2);
    const keys = routes.map((r) => r.steps.map((s) => `${s.from}>${s.to}:${s.kind}`).join('|'));
    expect(new Set(keys).size).toBe(routes.length);
    for (let i = 1; i < routes.length; i++) {
      expect(routes[i].totalCost).toBeGreaterThanOrEqual(routes[i - 1].totalCost);
    }
    for (const r of routes) {
      const visited = r.steps.map((s) => s.from).concat(r.to);
      expect(new Set(visited).size).toBe(visited.length); // loopless
    }
  });

  // jogress shortcut s->j->t (2 hops) vs a jogress-free detour s->p1..p4->t (5 hops).
  // Even with the default jogress surcharge the shortcut is cheaper, so it wins by
  // default — which is exactly what `avoidJogress` should flip.
  const gj = buildGraph(makeDb({
    s: { evolvesTo: ['j', 'p1'] },
    j: {
      evolvesTo: ['t'],
      condition: { jogressPartners: [{ slug: 's', name: 's', personality: 'Daring' }] },
    },
    p1: { evolvesTo: ['p2'] },
    p2: { evolvesTo: ['p3'] },
    p3: { evolvesTo: ['p4'] },
    p4: { evolvesTo: ['t'] },
    t: {},
  }));

  it('by default the cheaper jogress shortcut wins', () => {
    const [best] = findRoutes(gj, 's', 't');
    expect(best.steps.some((s) => s.class === 'jogress')).toBe(true);
  });

  it('avoidJogress demotes jogress so a jogress-free route ranks first', () => {
    const [best] = findRoutes(gj, 's', 't', { avoidJogress: true });
    expect(best.steps.some((s) => s.class === 'jogress')).toBe(false);
    expect(best.steps.map((s) => s.to)).toEqual(['p1', 'p2', 'p3', 'p4', 't']);
  });

  it('avoidJogress still keeps jogress reachable as the visible alternative', () => {
    const routes = findRoutes(gj, 's', 't', { avoidJogress: true });
    expect(routes.some((r) => r.steps.some((s) => s.class === 'jogress'))).toBe(true);
  });

  it('avoidJogress falls back to jogress when it is the only way', () => {
    const only = buildGraph(makeDb({
      x: { evolvesTo: ['jt'] },
      jt: { condition: { jogressPartners: [{ slug: 'x', name: 'x', personality: 'Daring' }] } },
    }));
    const routes = findRoutes(only, 'x', 'jt', { avoidJogress: true });
    expect(routes).toHaveLength(1);
    expect(routes[0].steps[0].class).toBe('jogress');
  });

  it('maxAgentRank gates digivolve arcs only', () => {
    const g2 = buildGraph(makeDb({
      lo: { evolvesTo: ['hi'] },
      hi: { evolvesTo: [], condition: { agentRank: { op: '>=', value: 8 } } },
    }));
    expect(findRoutes(g2, 'lo', 'hi', { maxAgentRank: 5 })).toEqual([]);
    // devolving FROM the high-rank form is unaffected
    const back = findRoutes(g2, 'hi', 'lo', { maxAgentRank: 5 });
    expect(back).toHaveLength(1);
    expect(back[0].steps[0].kind).toBe('dedigivolve');
  });
});

describe('route planner (real-data locks)', () => {
  const g = loadRealGraph();

  it('angemon → shakkoumon is one jogress step needing only Ankylomon', () => {
    const [best] = findRoutes(g, 'angemon', 'shakkoumon');
    expect(best.steps).toHaveLength(1);
    expect(best.steps[0].class).toBe('jogress');
    const partners = best.steps[0].requirement!.partners!;
    expect(partners.map((p) => p.slug)).toEqual(['ankylomon']);
  });

  it('avoidJogress routes around shakkoumon’s jogress step via devolve/re-evolve', () => {
    // Default: the direct 1-step jogress (locked above). With avoidJogress the
    // planner finds a longer jogress-free way in — a real end-to-end demotion.
    const [avoided] = findRoutes(g, 'angemon', 'shakkoumon', { avoidJogress: true });
    expect(avoided.steps.some((s) => s.class === 'jogress')).toBe(false);
    expect(avoided.to).toBe('shakkoumon');
  });

  it('veemon → magnamon is one item step (Digi-Egg of Miracles)', () => {
    const [best] = findRoutes(g, 'veemon', 'magnamon');
    expect(best.steps).toHaveLength(1);
    expect(best.steps[0].class).toBe('item');
    expect(best.steps[0].requirement!.item).toBe('Digi-Egg of Miracles');
  });

  it('omnimon-x-antibody → omnimon classifies as plain (mode toggle, no partners)', () => {
    expect(classifyForwardEdge(g, 'omnimon-x-antibody', 'omnimon')).toBe('plain');
    const req = stepRequirement(g, 'omnimon-x-antibody', 'omnimon');
    expect(req.partners).toBeUndefined();
  });

  it('wargreymon → metalgarurumon descends then climbs', () => {
    const [best] = findRoutes(g, 'wargreymon', 'metalgarurumon');
    expect(best.steps.length).toBeGreaterThan(0);
    expect(best.steps.some((s) => s.kind === 'dedigivolve')).toBe(true);
    expect(best.steps[best.steps.length - 1].to).toBe('metalgarurumon');
  });

  it('property: 200 seeded random pairs produce valid contiguous routes', () => {
    // deterministic LCG so the test is reproducible
    let seed = 42;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    for (let i = 0; i < 200; i++) {
      const from = g.slugs[Math.floor(rand() * g.slugs.length)];
      const to = g.slugs[Math.floor(rand() * g.slugs.length)];
      const routes = findRoutes(g, from, to, { k: 2 });
      expect(routes.length).toBeGreaterThan(0); // bidirected graph is connected
      for (const r of routes) {
        let cur = from;
        let cost = 0;
        const visited = new Set([from]);
        for (const step of r.steps) {
          expect(step.from).toBe(cur);
          if (step.kind === 'digivolve') {
            expect(g.db.digimon[step.from].evolvesTo).toContain(step.to);
          } else {
            expect(g.db.digimon[step.to].evolvesTo).toContain(step.from);
          }
          expect(visited.has(step.to)).toBe(false); // loopless
          visited.add(step.to);
          cost += step.cost;
          cur = step.to;
        }
        expect(cur).toBe(to);
        expect(cost).toBe(r.totalCost);
      }
    }
  });
});
