import { describe, expect, it } from 'vitest';
import { PERSONALITY_KEYS } from '../schema';
import { buildSearchIndex, filterSlugs, search } from '../search';
import { loadRealGraph } from './fixture';

const g = loadRealGraph();
const index = buildSearchIndex(g.db);

describe('search', () => {
  it('ranks exact > prefix > substring', () => {
    const hits = search(index, 'agumon');
    expect(hits[0].slug).toBe('agumon'); // exact beats "Agumon (Black)" etc.
    const slugs = hits.map((h) => h.slug);
    expect(slugs).toContain('agumon-black');
  });

  it('prefix beats mid-name substring', () => {
    const hits = search(index, 'gre');
    expect(g.db.digimon[hits[0].slug].name.toLowerCase().startsWith('gre')).toBe(true);
  });

  it('finds by dex number with and without #', () => {
    expect(search(index, '#21')[0].slug).toBe(g.slugs[20]);
    expect(search(index, '21')[0].slug).toBe(g.slugs[20]);
  });

  it('caps results', () => {
    expect(search(index, 'mon', 12)).toHaveLength(12);
  });
});

describe('filterSlugs', () => {
  it('facet counts match measured data', () => {
    expect(filterSlugs(g.db, { special: new Set(['ridable']) }).size).toBe(189);
    expect(filterSlugs(g.db, { special: new Set(['item']) }).size).toBe(18);
    expect(filterSlugs(g.db, { special: new Set(['jogress']) }).size).toBe(17);
    expect(filterSlugs(g.db, { special: new Set(['bond']) }).size).toBe(11);
    expect(filterSlugs(g.db, { generations: new Set(['Armor']) }).size).toBe(10);
  });

  it('ORs within a facet, ANDs across facets', () => {
    const vaccineOrData = filterSlugs(g.db, { attributes: new Set(['Vaccine', 'Data']) });
    const vaccine = filterSlugs(g.db, { attributes: new Set(['Vaccine']) });
    expect(vaccineOrData.size).toBeGreaterThan(vaccine.size);

    const megaVaccine = filterSlugs(g.db, {
      generations: new Set(['Mega']),
      attributes: new Set(['Vaccine']),
    });
    for (const slug of megaVaccine) {
      expect(g.db.digimon[slug].generation).toBe('Mega');
      expect(g.db.digimon[slug].attribute).toBe('Vaccine');
    }
  });

  it('empty criteria matches everything', () => {
    expect(filterSlugs(g.db, {}).size).toBe(475);
  });

  it('filters by base personality — every hit has the selected personality', () => {
    const sly = filterSlugs(g.db, { personalities: new Set(['Sly']) });
    expect(sly.size).toBeGreaterThan(0);
    for (const slug of sly) expect(g.db.digimon[slug].basePersonality).toBe('Sly');
  });

  it('personality facet ORs within, ANDs across', () => {
    const one = filterSlugs(g.db, { personalities: new Set(['Sly']) });
    const two = filterSlugs(g.db, { personalities: new Set(['Sly', 'Brave']) });
    expect(two.size).toBeGreaterThan(one.size);

    const slyVaccine = filterSlugs(g.db, {
      personalities: new Set(['Sly']),
      attributes: new Set(['Vaccine']),
    });
    for (const slug of slyVaccine) {
      expect(g.db.digimon[slug].basePersonality).toBe('Sly');
      expect(g.db.digimon[slug].attribute).toBe('Vaccine');
    }
  });

  it('every Digimon has a base personality — all 16 selected matches all 475', () => {
    expect(filterSlugs(g.db, { personalities: new Set(PERSONALITY_KEYS) }).size).toBe(475);
  });
});
