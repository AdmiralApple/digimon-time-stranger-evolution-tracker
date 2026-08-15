import type { DigimonDatabase } from './schema';

export class DataLoadError extends Error {}

export async function loadDatabase(signal?: AbortSignal): Promise<DigimonDatabase> {
  const res = await fetch('/digimon.json', { signal });
  if (!res.ok) throw new DataLoadError(`Failed to fetch digimon.json: HTTP ${res.status}`);
  const db = (await res.json()) as DigimonDatabase;
  if (db?.meta?.schemaVersion !== 1) {
    throw new DataLoadError(`Unsupported schemaVersion: ${db?.meta?.schemaVersion}`);
  }
  const count = Object.keys(db.digimon).length;
  if (db.meta.count !== count) {
    throw new DataLoadError(`meta.count ${db.meta.count} != ${count} records`);
  }
  return db;
}

/** Full-size 256px icon (detail-panel hero portrait). */
export const iconUrl = (slug: string): string => `/icons/${slug}.png`;

// Node + list thumbnails now come from the shared sprite atlas — see
// src/data/atlas.ts (one request for all of them, warmed via preloadAtlas).
