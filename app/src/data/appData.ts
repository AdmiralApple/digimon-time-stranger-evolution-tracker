import layoutJson from '../generated/layout.json';
import { buildGraph, type EvolutionGraph } from './graph';
import { buildSearchIndex, type SearchEntry } from './search';
import type { DigimonDatabase, StatKey } from './schema';
import { STAT_KEYS } from './schema';

export interface LayoutData {
  meta: { dataScrapedAt: string; nodeCount: number; edgeCount: number };
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  columns: Array<{ x: number; generations: string[]; count: number }>;
  hybridLane: { y: number; x: number; label: string };
  positions: Record<string, { x: number; y: number }>;
}

export interface AppData {
  db: DigimonDatabase;
  graph: EvolutionGraph;
  layout: LayoutData;
  searchIndex: SearchEntry[];
  /** Global per-stat lv99 maxima — stat bars normalize against these. */
  statMaxima: Record<StatKey, number>;
}

let data: AppData | null = null;

export function initAppData(db: DigimonDatabase): AppData {
  const graph = buildGraph(db);
  const statMaxima = Object.fromEntries(STAT_KEYS.map((k) => [k, 1])) as Record<StatKey, number>;
  for (const d of Object.values(db.digimon)) {
    for (const key of STAT_KEYS) {
      statMaxima[key] = Math.max(statMaxima[key], d.stats[key].lv99);
    }
  }
  data = {
    db,
    graph,
    layout: layoutJson as LayoutData,
    searchIndex: buildSearchIndex(db),
    statMaxima,
  };
  return data;
}

/** Module singleton so non-React code (cy controllers) can reach the data. */
export function appData(): AppData {
  if (!data) throw new Error('appData accessed before initAppData()');
  return data;
}
