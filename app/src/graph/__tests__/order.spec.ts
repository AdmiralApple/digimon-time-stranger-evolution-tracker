import { describe, expect, it } from 'vitest';
import { centeredSlots, hiddenFirstOrder } from '../order';

describe('centeredSlots', () => {
  it('centers three related forms around visual index 40', () => {
    const row = Array.from({ length: 50 }, (_, index) => `n${index}`);
    const slots = centeredSlots(row, new Set(['n3', 'n17', 'n45']), 40);

    expect(slots.get('n3')).toBe(39);
    expect(slots.get('n17')).toBe(40);
    expect(slots.get('n45')).toBe(41);
    expect(new Set(slots.values()).size).toBe(row.length);
  });

  it('allows centered connections to extend beyond the old right edge', () => {
    const row = ['a', 'b', 'c', 'd'];
    const slots = centeredSlots(row, new Set(['a', 'c']), 8);

    expect(slots.get('a')).toBe(8);
    expect(slots.get('c')).toBe(9);
    expect(Math.max(...slots.values())).toBe(9);
  });

  it('preserves the relative order of unrelated forms', () => {
    const row = ['a', 'b', 'c', 'd', 'e'];
    const slots = centeredSlots(row, new Set(['b', 'd']), 2);
    const unrelated = ['a', 'c', 'e'].sort((a, b) => slots.get(a)! - slots.get(b)!);

    expect(unrelated).toEqual(['a', 'c', 'e']);
  });
});

describe('hiddenFirstOrder', () => {
  it('moves silhouettes to the leading edge without disturbing either group', () => {
    const ordered = ['a', 'b', 'c', 'd', 'e'];
    const result = hiddenFirstOrder(ordered, new Set(['b', 'd']));

    expect(result).toEqual(['b', 'd', 'a', 'c', 'e']);
    expect(ordered).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});
