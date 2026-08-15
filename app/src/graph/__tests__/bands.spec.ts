import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import type { LayoutData } from '../../data/appData';
import { computeBands } from '../bands';

const layout = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../generated/layout.json', import.meta.url)), 'utf8'),
) as LayoutData;

describe('computeBands', () => {
  const bands = computeBands(layout);

  test('one band per stage: every layout column plus the hybrid lane', () => {
    expect(bands.length).toBe(layout.columns.length + 1);
  });

  test('bands tile the axis gaplessly and in order', () => {
    for (let i = 1; i < bands.length; i++) {
      expect(bands[i].lo).toBeCloseTo(bands[i - 1].hi); // no gaps, no overlaps
      expect(bands[i].hi).toBeGreaterThan(bands[i].lo); // strictly forward
    }
  });

  test('shading alternates and starts on the first stage', () => {
    expect(bands.map((b) => b.tint)).toEqual(bands.map((_, i) => i % 2 === 0));
  });

  test('coverage spans every stage centre, including the hybrid lane', () => {
    const lo = bands[0].lo;
    const hi = bands[bands.length - 1].hi;
    for (const c of layout.columns) {
      expect(c.x).toBeGreaterThanOrEqual(lo);
      expect(c.x).toBeLessThanOrEqual(hi);
    }
    expect(layout.hybridLane.x).toBeLessThanOrEqual(hi);
    expect(layout.bounds.maxX).toBeLessThanOrEqual(hi); // rightmost hybrid depth column covered
  });

  test('each node falls inside exactly one band on the generation axis', () => {
    for (const { x } of Object.values(layout.positions)) {
      const hits = bands.filter((b) => x >= b.lo && x <= b.hi);
      // interior nodes hit one band; a node sitting exactly on a boundary hits two
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits.length).toBeLessThanOrEqual(2);
    }
  });
});
