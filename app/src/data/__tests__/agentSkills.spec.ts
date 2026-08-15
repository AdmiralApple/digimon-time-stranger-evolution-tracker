import { describe, expect, it } from 'vitest';
import {
  AGENT_SKILL_CATEGORIES,
  clampStacks,
  EMPTY_AGENT_SKILLS,
  hasAnyStacks,
  MAX_STACKS,
  PERSONALITY_CATEGORY,
  reduceRouteSteps,
  reduceStat,
  reductionPct,
  stacksForPersonality,
} from '../agentSkills';
import type { RouteStep } from '../route';
import { makeDb } from './fixture';

describe('PERSONALITY_CATEGORY', () => {
  it('assigns all 16 personalities, four to each bond', () => {
    const entries = Object.entries(PERSONALITY_CATEGORY);
    expect(entries).toHaveLength(16);
    for (const category of AGENT_SKILL_CATEGORIES) {
      expect(entries.filter(([, c]) => c === category)).toHaveLength(4);
    }
  });
});

describe('clampStacks', () => {
  it('bounds to [0, MAX_STACKS] and truncates to whole stacks', () => {
    expect(clampStacks(-3)).toBe(0);
    expect(clampStacks(0)).toBe(0);
    expect(clampStacks(2.9)).toBe(2);
    expect(clampStacks(MAX_STACKS + 5)).toBe(MAX_STACKS);
    expect(clampStacks(Number.NaN)).toBe(0);
  });
});

describe('reductionPct', () => {
  it('is 20% per stack up to 80%', () => {
    expect(reductionPct(0)).toBe(0);
    expect(reductionPct(1)).toBe(20);
    expect(reductionPct(2)).toBe(40);
    expect(reductionPct(4)).toBe(80);
    expect(reductionPct(9)).toBe(80); // clamped
  });
});

describe('reduceStat', () => {
  it('rounds down and never rounds a requirement up', () => {
    expect(reduceStat(500, 0)).toBe(500); // no stacks → untouched
    expect(reduceStat(500, 1)).toBe(400); // −20%
    expect(reduceStat(500, 2)).toBe(300); // −40%
    expect(reduceStat(500, 4)).toBe(100); // −80%
    expect(reduceStat(333, 1)).toBe(266); // 266.4 floored
    expect(reduceStat(333, 4)).toBe(66); // 66.6 floored
  });

  it('is exact on integer results (no float-floor slippage)', () => {
    // 5 * 0.6 = 3 exactly; a naive value*factor could yield 2.9999… → 2.
    expect(reduceStat(5, 2)).toBe(3);
    expect(reduceStat(10, 2)).toBe(6);
    expect(reduceStat(25, 1)).toBe(20);
  });
});

describe('stacksForPersonality', () => {
  it('reads the stack count of the personality’s owning bond', () => {
    const stacks = { ...EMPTY_AGENT_SKILLS, Valor: 3, Wisdom: 1 };
    expect(stacksForPersonality('Brave', stacks)).toBe(3); // Valor
    expect(stacksForPersonality('Sly', stacks)).toBe(1); // Wisdom
    expect(stacksForPersonality('Devoted', stacks)).toBe(0); // Philanthropy, unset
  });
});

describe('hasAnyStacks', () => {
  it('detects whether any bond is stacked', () => {
    expect(hasAnyStacks(EMPTY_AGENT_SKILLS)).toBe(false);
    expect(hasAnyStacks({ ...EMPTY_AGENT_SKILLS, Amicability: 1 })).toBe(true);
  });
});

describe('reduceRouteSteps', () => {
  // makeDb defaults every node's basePersonality to 'Daring' (a Valor bond).
  const db = makeDb({ a: { evolvesTo: ['b'] }, b: {} });
  const steps: RouteStep[] = [
    { from: 'x', to: 'a', kind: 'dedigivolve', class: null, cost: 100, requirement: null },
    {
      from: 'a',
      to: 'b',
      kind: 'digivolve',
      class: 'plain',
      cost: 105,
      requirement: { agentRank: 5, stats: { HP: 500, ATK: 333 } },
    },
  ];

  it('reduces forward-step stats by the target bond’s stacks; other fields untouched', () => {
    const [dedigi, digi] = reduceRouteSteps(steps, db, { ...EMPTY_AGENT_SKILLS, Valor: 2 });
    expect(dedigi.requirement).toBeNull(); // de-digivolve passes through
    expect(digi.requirement).toEqual({ agentRank: 5, stats: { HP: 300, ATK: 199 } });
  });

  it('leaves steps whose bond has no stacks unchanged (identity)', () => {
    const out = reduceRouteSteps(steps, db, { ...EMPTY_AGENT_SKILLS, Wisdom: 4 });
    expect(out[1]).toBe(steps[1]); // same reference, no clone
  });
});
