import { describe, expect, it } from 'vitest';
import { ancestors, buildGraph, descendants, lineage } from '../graph';
import { loadRealGraph, makeDb } from './fixture';

describe('graph traversal (synthetic)', () => {
  const g = buildGraph(makeDb({
    a: { evolvesTo: ['b'] },
    b: { evolvesTo: ['c', 'd'] },
    c: { evolvesTo: [] },
    d: { evolvesTo: ['e'] },
    e: { evolvesTo: ['d'] }, // 2-cycle d <-> e
  }));

  it('descendants are cycle-safe and exclude self', () => {
    expect(descendants(g, 'a')).toEqual(new Set(['b', 'c', 'd', 'e']));
    expect(descendants(g, 'd')).toEqual(new Set(['e'])); // d excluded despite d->e->d
  });

  it('ancestors mirror over reverse edges', () => {
    expect(ancestors(g, 'e')).toEqual(new Set(['d', 'a', 'b']));
    expect(ancestors(g, 'a')).toEqual(new Set());
  });

  it('lineage = ancestors ∪ focus ∪ descendants with induced edges', () => {
    const l = lineage(g, 'd');
    expect(l.nodes).toEqual(new Set(['a', 'b', 'd', 'e']));
    expect(l.edges).toContainEqual(['d', 'e']);
    expect(l.edges).toContainEqual(['e', 'd']);
    expect(l.edges).not.toContainEqual(['b', 'c']); // c not in lineage
  });

  it('excluding a node prunes it and everything only reachable through it', () => {
    // From b, excluding d drops d AND e (e is reachable only via d).
    expect(descendants(g, 'b', new Set(['d']))).toEqual(new Set(['c']));
    // c has no descendants, so excluding it just removes c.
    expect(descendants(g, 'b', new Set(['c']))).toEqual(new Set(['d', 'e']));
  });

  it('excluded pruning re-derives lineage and drops now-orphaned edges', () => {
    const l = lineage(g, 'a', new Set(['b']));
    // b gated the whole tree below a; excluding it leaves a stranded.
    expect(l.nodes).toEqual(new Set(['a']));
    expect(l.edges).not.toContainEqual(['a', 'b']);
  });

  it('a node reachable through a kept branch survives exclusion of another', () => {
    //   x → p → z  and  x → q → z : z is shared. Excluding p keeps z (via q).
    const shared = buildGraph(makeDb({
      x: { evolvesTo: ['p', 'q'] },
      p: { evolvesTo: ['z'] },
      q: { evolvesTo: ['z'] },
      z: { evolvesTo: [] },
    }));
    expect(descendants(shared, 'x', new Set(['p']))).toEqual(new Set(['q', 'z']));
  });

  it('the focus is never removed, even if named in excluded', () => {
    expect(lineage(g, 'd', new Set(['d'])).nodes.has('d')).toBe(true);
  });
});

describe('graph traversal (real data)', () => {
  const g = loadRealGraph();

  it('terminates on the omnimon 2-cycle cluster and excludes self', () => {
    const desc = descendants(g, 'omnimon');
    expect(desc.has('omnimon')).toBe(false);
    expect(desc.has('omnimon-x-antibody')).toBe(true);
    const anc = ancestors(g, 'omnimon');
    expect(anc.has('wargreymon')).toBe(true);
    expect(anc.has('omnimon')).toBe(false);
    expect(anc.has('omnimon-x-antibody')).toBe(true); // via the 2-cycle
  });

  it('the 7 In-Training I roots have no ancestors', () => {
    const roots = g.slugs.filter((s) => g.db.digimon[s].evolvesFrom.length === 0);
    expect(roots).toHaveLength(7);
    for (const root of roots) {
      expect(g.db.digimon[root].generation).toBe('In-Training I');
      expect(ancestors(g, root).size).toBe(0);
    }
  });

  it('punimon lineage matches the measured size (295 excluding self)', () => {
    const l = lineage(g, 'punimon');
    expect(l.nodes.size).toBe(296); // 295 + focus
  });
});
