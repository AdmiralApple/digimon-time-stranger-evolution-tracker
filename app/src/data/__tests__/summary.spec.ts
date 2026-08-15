import { describe, expect, it } from 'vitest';
import { summarizeRoute } from '../summary';
import type { RouteStep } from '../route';

describe('summarizeRoute', () => {
  it('folds max/union over forward steps and counts kinds', () => {
    const steps: RouteStep[] = [
      { from: 'a', to: 'b', kind: 'dedigivolve', class: null, cost: 100, requirement: null },
      {
        from: 'b', to: 'c', kind: 'digivolve', class: 'plain', cost: 105,
        requirement: { agentRank: 3, stats: { HP: 500, ATK: 200 } },
      },
      {
        from: 'c', to: 'd', kind: 'digivolve', class: 'item', cost: 255,
        requirement: { agentRank: 7, stats: { HP: 300 }, item: 'Digi-Egg of Courage', talent: 30 },
      },
      {
        from: 'd', to: 'e', kind: 'digivolve', class: 'jogress', cost: 305,
        requirement: {
          agentRank: 8, stats: {},
          partners: [{ slug: 'x', name: 'X', personality: 'Daring' }],
          agentSkills: [{ category: 'Valor', value: 46 }],
        },
      },
    ];
    const s = summarizeRoute(steps);
    expect(s.maxAgentRank).toBe(8);
    expect(s.maxStats).toEqual({ HP: 500, ATK: 200 });
    expect(s.maxTalent).toBe(30);
    expect(s.items).toEqual(['Digi-Egg of Courage']);
    expect(s.partners.map((p) => p.slug)).toEqual(['x']);
    expect(s.agentSkills).toEqual([{ category: 'Valor', value: 46 }]);
    expect(s.counts).toEqual({ digivolves: 3, dedigivolves: 1, jogressSteps: 1, itemSteps: 1 });
  });
});
