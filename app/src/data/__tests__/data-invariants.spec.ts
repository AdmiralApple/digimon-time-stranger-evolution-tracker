// Regression gate for future scraper re-drops: if a new data/digimon.json
// violates what the app relies on, this suite fails before the UI misbehaves.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadRealGraph } from './fixture';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const g = loadRealGraph();
const records = g.slugs.map((s) => g.db.digimon[s]);

describe('data invariants', () => {
  it('475 records, meta.count matches, numbers unique 1..N', () => {
    expect(records).toHaveLength(475);
    expect(g.db.meta.count).toBe(records.length);
    expect(new Set(records.map((r) => r.number)).size).toBe(records.length);
  });

  it('no dangling evolvesTo/evolvesFrom references', () => {
    for (const r of records) {
      for (const to of r.evolvesTo) expect(g.db.digimon[to], `${r.slug}->${to}`).toBeDefined();
      for (const from of r.evolvesFrom) expect(g.db.digimon[from], `${r.slug}<-${from}`).toBeDefined();
    }
  });

  it('evolvesFrom is the exact inverse of evolvesTo', () => {
    for (const r of records) {
      for (const to of r.evolvesTo) {
        expect(g.db.digimon[to].evolvesFrom, `${r.slug}->${to} not mirrored`).toContain(r.slug);
      }
      for (const from of r.evolvesFrom) {
        expect(g.db.digimon[from].evolvesTo, `${r.slug}<-${from} not mirrored`).toContain(r.slug);
      }
    }
  });

  it('every condition has agentRank and uses only >= ops', () => {
    for (const r of records) {
      const cond = r.evolutionCondition;
      expect(cond.agentRank, r.slug).toBeDefined();
      expect(cond.agentRank.op).toBe('>=');
      for (const t of Object.values(cond.stats ?? {})) expect(t!.op).toBe('>=');
      if (cond.talent) expect(cond.talent.op).toBe('>=');
    }
  });

  it('jogress partner slugs resolve and never co-occur with items', () => {
    for (const r of records) {
      const cond = r.evolutionCondition;
      if (cond.jogressPartners) {
        expect(cond.requiredItem, r.slug).toBeUndefined();
        for (const p of cond.jogressPartners) {
          expect(g.db.digimon[p.slug], `${r.slug} partner ${p.slug}`).toBeDefined();
        }
      }
    }
  });

  it('every record has an icon file on disk', () => {
    const iconsDir = path.resolve(HERE, '../../../data/icons');
    for (const r of records) {
      expect(existsSync(path.join(iconsDir, `${r.slug}.png`)), r.slug).toBe(true);
    }
  });

  it('the layout file covers every slug', () => {
    const layout = JSON.parse(
      readFileSync(path.resolve(HERE, '../../generated/layout.json'), 'utf-8'),
    );
    for (const r of records) {
      expect(layout.positions[r.slug], r.slug).toBeDefined();
    }
  });
});
