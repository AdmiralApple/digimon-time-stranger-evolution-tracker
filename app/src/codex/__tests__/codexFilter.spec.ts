import { describe, expect, it } from 'vitest';
import type { Element, Personality, ResistanceMultiplier } from '../../data/schema';
import type { SpecialFacet } from '../../data/search';
import type { AttackType } from '../../data/skills';
import {
  advancedCount,
  cycleResist,
  elKey,
  hasAdvancedCriteria,
  matchesAdvanced,
  resistState,
  type AdvancedCriteria,
  type AdvancedTarget,
} from '../codexFilter';

type SkillSpec = { el: string; type?: AttackType | null };

// A neutral (×1 everywhere, no skills, no traits) target, overridable per test.
function target(over: {
  skills?: SkillSpec[];
  el?: Partial<Record<Element, ResistanceMultiplier>>;
  traits?: SpecialFacet[];
  personality?: Personality;
} = {}): AdvancedTarget {
  const el = {
    Fire: 1, Water: 1, Plant: 1, Ice: 1, Electricity: 1, Earth: 1,
    Steel: 1, Wind: 1, Light: 1, Dark: 1, Null: 1,
    ...over.el,
  } as Record<Element, ResistanceMultiplier>;
  return {
    specialSkills: (over.skills ?? []).map((s) => ({ element: s.el, type: s.type ?? null })),
    elementalResistances: el,
    traits: new Set(over.traits ?? []),
    basePersonality: over.personality ?? 'Brave',
  };
}

function criteria(over: Partial<AdvancedCriteria> = {}): AdvancedCriteria {
  return {
    skillElements: new Set(), skillTypes: new Set(), resist: new Set(), weak: new Set(),
    special: new Set(), personalities: new Set(), ...over,
  };
}

describe('matchesAdvanced', () => {
  it('passes any target when there are no constraints', () => {
    expect(matchesAdvanced(target(), criteria())).toBe(true);
  });

  it('special-skill element facet is OR within', () => {
    const t = target({ skills: [{ el: 'Fire', type: 'magic' }] });
    expect(matchesAdvanced(t, criteria({ skillElements: new Set(['Fire', 'Dark']) }))).toBe(true);
    expect(matchesAdvanced(t, criteria({ skillElements: new Set(['Dark']) }))).toBe(false);
  });

  it('skill-kind facet matches a non-damaging skill by its effect category', () => {
    const healer = target({ skills: [{ el: 'Recovery' }] });
    expect(matchesAdvanced(healer, criteria({ skillTypes: new Set(['Recovery']) }))).toBe(true);
    expect(
      matchesAdvanced(target({ skills: [{ el: 'Fire', type: 'magic' }] }), criteria({ skillTypes: new Set(['Recovery']) })),
    ).toBe(false);
  });

  it('skill-kind facet is OR within — attack types and effects are one axis', () => {
    const t = target({ skills: [{ el: 'Fire', type: 'magic' }] });
    expect(matchesAdvanced(t, criteria({ skillTypes: new Set(['magic']) }))).toBe(true);
    expect(matchesAdvanced(t, criteria({ skillTypes: new Set(['physical']) }))).toBe(false);
    // "magic OR recovery" — the magic attack satisfies it (the two combine as OR,
    // not same-skill AND, so this no longer wrongly returns nothing)
    expect(matchesAdvanced(t, criteria({ skillTypes: new Set(['magic', 'Recovery']) }))).toBe(true);
    const healer = target({ skills: [{ el: 'Recovery' }] });
    expect(matchesAdvanced(healer, criteria({ skillTypes: new Set(['magic', 'Recovery']) }))).toBe(true);
  });

  it('combines element + kind SAME-SKILL, not independently', () => {
    // A Fire *magic* attack and a Water *physical* attack, on different skills.
    const t = target({ skills: [{ el: 'Fire', type: 'magic' }, { el: 'Water', type: 'physical' }] });
    // "Fire physical" — no single skill is both → miss (independent-AND would wrongly pass)
    expect(matchesAdvanced(t, criteria({ skillElements: new Set(['Fire']), skillTypes: new Set(['physical']) }))).toBe(false);
    // "Fire magic" — the Fire skill is magic → hit
    expect(matchesAdvanced(t, criteria({ skillElements: new Set(['Fire']), skillTypes: new Set(['magic']) }))).toBe(true);
    // "Water physical" — hit
    expect(matchesAdvanced(t, criteria({ skillElements: new Set(['Water']), skillTypes: new Set(['physical']) }))).toBe(true);
  });

  it("a non-damaging skill's kind is its effect, never an attack type", () => {
    const t = target({ skills: [{ el: 'Buff', type: null }] });
    expect(matchesAdvanced(t, criteria({ skillTypes: new Set(['Buff']) }))).toBe(true);
    expect(matchesAdvanced(t, criteria({ skillTypes: new Set(['physical']) }))).toBe(false);
  });

  it('resist requires ×0 or ×0.5; ×1 and above fail', () => {
    expect(matchesAdvanced(target({ el: { Fire: 0.5 } }), criteria({ resist: new Set([elKey('Fire')]) }))).toBe(true);
    expect(matchesAdvanced(target({ el: { Fire: 0 } }), criteria({ resist: new Set([elKey('Fire')]) }))).toBe(true);
    expect(matchesAdvanced(target({ el: { Fire: 1 } }), criteria({ resist: new Set([elKey('Fire')]) }))).toBe(false);
    expect(matchesAdvanced(target({ el: { Fire: 2 } }), criteria({ resist: new Set([elKey('Fire')]) }))).toBe(false);
  });

  it('weak requires ×1.5 or ×2; ×1 and below fail', () => {
    expect(matchesAdvanced(target({ el: { Dark: 2 } }), criteria({ weak: new Set([elKey('Dark')]) }))).toBe(true);
    expect(matchesAdvanced(target({ el: { Dark: 1.5 } }), criteria({ weak: new Set([elKey('Dark')]) }))).toBe(true);
    expect(matchesAdvanced(target({ el: { Dark: 1 } }), criteria({ weak: new Set([elKey('Dark')]) }))).toBe(false);
    expect(matchesAdvanced(target({ el: { Dark: 0.5 } }), criteria({ weak: new Set([elKey('Dark')]) }))).toBe(false);
  });

  it('resistance facet is AND within — every constraint must hold', () => {
    const t = target({ el: { Fire: 0.5, Dark: 2 } });
    expect(matchesAdvanced(t, criteria({ resist: new Set([elKey('Fire')]), weak: new Set([elKey('Dark')]) }))).toBe(true);
    expect(matchesAdvanced(t, criteria({ resist: new Set([elKey('Fire'), elKey('Water')]) }))).toBe(false);
  });

  it('ANDs across facets (skill and resistance together)', () => {
    const t = target({ skills: [{ el: 'Fire', type: 'magic' }], el: { Ice: 0.5 } });
    expect(
      matchesAdvanced(t, criteria({ skillElements: new Set(['Fire']), resist: new Set([elKey('Ice')]) })),
    ).toBe(true);
    expect(
      matchesAdvanced(t, criteria({ skillElements: new Set(['Water']), resist: new Set([elKey('Ice')]) })),
    ).toBe(false);
  });

  it('trait facet is OR within — matches a target holding any selected trait', () => {
    const jog = target({ traits: ['jogress'] });
    expect(matchesAdvanced(jog, criteria({ special: new Set(['jogress']) }))).toBe(true);
    expect(matchesAdvanced(jog, criteria({ special: new Set(['item', 'jogress']) }))).toBe(true);
    expect(matchesAdvanced(jog, criteria({ special: new Set(['item']) }))).toBe(false);
  });

  it('trait facet ANDs against the other facets', () => {
    const t = target({ traits: ['ridable'], skills: [{ el: 'Fire', type: 'magic' }] });
    expect(
      matchesAdvanced(t, criteria({ special: new Set(['ridable']), skillElements: new Set(['Fire']) })),
    ).toBe(true);
    expect(
      matchesAdvanced(t, criteria({ special: new Set(['ridable']), skillElements: new Set(['Water']) })),
    ).toBe(false);
  });

  it('personality facet is OR within — matches a target whose base personality is selected', () => {
    const sly = target({ personality: 'Sly' });
    expect(matchesAdvanced(sly, criteria({ personalities: new Set(['Sly']) }))).toBe(true);
    expect(matchesAdvanced(sly, criteria({ personalities: new Set(['Sly', 'Brave']) }))).toBe(true);
    expect(matchesAdvanced(sly, criteria({ personalities: new Set(['Brave']) }))).toBe(false);
  });

  it('personality facet ANDs against the other facets', () => {
    const t = target({ personality: 'Reckless', skills: [{ el: 'Fire', type: 'magic' }] });
    expect(
      matchesAdvanced(t, criteria({ personalities: new Set(['Reckless']), skillElements: new Set(['Fire']) })),
    ).toBe(true);
    expect(
      matchesAdvanced(t, criteria({ personalities: new Set(['Reckless']), skillElements: new Set(['Water']) })),
    ).toBe(false);
  });
});

describe('cycleResist / resistState', () => {
  const key = elKey('Fire');

  it('cycles off → resist → weak → off', () => {
    let resist: ReadonlySet<string> = new Set();
    let weak: ReadonlySet<string> = new Set();
    expect(resistState(resist, weak, key)).toBe('off');

    ({ resist, weak } = cycleResist(resist, weak, key));
    expect(resistState(resist, weak, key)).toBe('resist');

    ({ resist, weak } = cycleResist(resist, weak, key));
    expect(resistState(resist, weak, key)).toBe('weak');

    ({ resist, weak } = cycleResist(resist, weak, key));
    expect(resistState(resist, weak, key)).toBe('off');
  });

  it('never leaves a key in both sets', () => {
    const { resist, weak } = cycleResist(new Set([key]), new Set(), key); // resist → weak
    expect(resist.has(key)).toBe(false);
    expect(weak.has(key)).toBe(true);
  });

  it('does not mutate the input sets', () => {
    const resist = new Set<string>();
    const weak = new Set<string>();
    cycleResist(resist, weak, key);
    expect(resist.size).toBe(0);
    expect(weak.size).toBe(0);
  });
});

describe('hasAdvancedCriteria / advancedCount', () => {
  it('reports emptiness and totals', () => {
    expect(hasAdvancedCriteria(criteria())).toBe(false);
    expect(advancedCount(criteria())).toBe(0);
    const c = criteria({
      skillElements: new Set(['Fire', 'Dark']),
      skillTypes: new Set(['physical']),
      resist: new Set([elKey('Ice')]),
      weak: new Set([elKey('Light')]),
      special: new Set(['jogress', 'ridable']),
      personalities: new Set(['Sly', 'Brave']),
    });
    expect(hasAdvancedCriteria(c)).toBe(true);
    expect(advancedCount(c)).toBe(9);

    // the trait facet alone counts, too
    expect(hasAdvancedCriteria(criteria({ special: new Set(['bond']) }))).toBe(true);
    expect(advancedCount(criteria({ special: new Set(['bond']) }))).toBe(1);

    // the personality facet alone counts, too
    expect(hasAdvancedCriteria(criteria({ personalities: new Set(['Enlightened']) }))).toBe(true);
    expect(advancedCount(criteria({ personalities: new Set(['Enlightened', 'Astute']) }))).toBe(2);
  });
});
