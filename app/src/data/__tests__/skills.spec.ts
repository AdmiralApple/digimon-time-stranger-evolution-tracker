import { describe, expect, it } from 'vitest';
import { classifyAttackType } from '../skills';

describe('classifyAttackType', () => {
  it('reads the skill’s own attack type from the description', () => {
    expect(classifyAttackType('[Target: 1 enemy] Performs Dark magic attack at power 35.')).toBe('magic');
    expect(classifyAttackType('[Target: 1 enemy] Performs Steel physical attack at power 8 x 5 hits.')).toBe('physical');
    expect(classifyAttackType('Performs Fire magical attack at power 50.')).toBe('magic'); // "magical" variant
  });

  it('returns null for non-attacks and ignores counter clauses on buffs', () => {
    expect(classifyAttackType('Increases ATK for 3 turns.')).toBeNull();
    expect(classifyAttackType('Restores 30% of max HP.')).toBeNull();
    // A buff whose prose merely mentions attacks must not be classified as one:
    expect(
      classifyAttackType('[Target: User] Upon receiving a physical attack, counters with an Electricity magic attack at power 90.'),
    ).toBeNull();
    expect(classifyAttackType('')).toBeNull();
  });
});
