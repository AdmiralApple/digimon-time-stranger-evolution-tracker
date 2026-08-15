import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
import type { Digimon, DigimonDatabase, EvolutionCondition } from '../schema';
import { buildGraph, type EvolutionGraph } from '../graph';

let realGraph: EvolutionGraph | null = null;

/** The real scraped dataset, loaded from disk (node test env, no fetch). */
export function loadRealGraph(): EvolutionGraph {
  if (!realGraph) {
    const file = path.resolve(HERE, '../../../data/digimon.json');
    const db = JSON.parse(readFileSync(file, 'utf-8')) as DigimonDatabase;
    realGraph = buildGraph(db);
  }
  return realGraph;
}

interface NodeSpec {
  evolvesTo?: string[];
  condition?: Partial<EvolutionCondition>;
}

/** Synthetic mini-database: evolvesFrom is computed, everything else defaulted. */
export function makeDb(nodes: Record<string, NodeSpec>): DigimonDatabase {
  const slugs = Object.keys(nodes);
  const inverse = new Map<string, string[]>(slugs.map((s) => [s, []]));
  for (const [slug, spec] of Object.entries(nodes)) {
    for (const to of spec.evolvesTo ?? []) inverse.get(to)?.push(slug);
  }
  const digimon: Record<string, Digimon> = {};
  slugs.forEach((slug, i) => {
    digimon[slug] = {
      number: i + 1,
      slug,
      name: slug,
      generation: 'Rookie',
      attribute: 'Free',
      type: 'Test',
      traits: [],
      basePersonality: 'Daring',
      ridable: false,
      description: 'test',
      icon: `icons/${slug}.png`,
      stats: {
        HP: { lv1: 100, lv99: 1000 }, SP: { lv1: 100, lv99: 1000 },
        ATK: { lv1: 100, lv99: 1000 }, DEF: { lv1: 100, lv99: 1000 },
        INT: { lv1: 100, lv99: 1000 }, SPI: { lv1: 100, lv99: 1000 },
        SPD: { lv1: 100, lv99: 1000 },
      },
      attributeResistances: {
        Vaccine: 1, Data: 1, Virus: 1, Free: 1, Variable: 1, Unknown: 1, 'No Data': 1,
      },
      elementalResistances: {
        Fire: 1, Water: 1, Plant: 1, Ice: 1, Electricity: 1, Earth: 1,
        Steel: 1, Wind: 1, Light: 1, Dark: 1, Null: 1,
      },
      conversionPersonalities: {
        Adoring: 6.25, Devoted: 6.25, Tolerant: 6.25, Overprotective: 6.25,
        Zealous: 6.25, Brave: 6.25, Reckless: 6.25, Daring: 6.25,
        Enlightened: 6.25, Sly: 6.25, Astute: 6.25, Strategic: 6.25,
        Opportunistic: 6.25, Friendly: 6.25, Sociable: 6.25, Compassionate: 6.25,
      },
      evolutionCondition: { agentRank: { op: '>=', value: 1 }, ...nodes[slug].condition },
      evolvesTo: nodes[slug].evolvesTo ?? [],
      evolvesFrom: inverse.get(slug)!,
      devolvesFrom: [],
      specialSkills: [],
      attachmentSkills: [],
      postEvolutionDialogue: null,
    };
  });
  return {
    meta: { schemaVersion: 1, source: 'test', scrapedAt: '2026-07-11T00:00:00Z', count: slugs.length },
    digimon,
  };
}
