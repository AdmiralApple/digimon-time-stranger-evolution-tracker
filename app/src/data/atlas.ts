// Sprite-atlas addressing. Every thumbnail lives in one webp sheet
// (public/atlas/thumbs.webp, built by scripts/sync-data.mjs); a slug maps to a
// tile via its index in the manifest's `slugs` order. Consumers scale the sheet
// so one tile fills the element box, then shift it into view — the classic CSS
// sprite trick — so the whole app pays a single image request instead of ~475.
import manifest from '../generated/atlas.json';

/** URL of the atlas sheet (content-hash query → immutable-cacheable, auto-busts). */
export const ATLAS_SRC = manifest.src;
export const ATLAS_COLS = manifest.cols;
export const ATLAS_ROWS = manifest.rows;

// Background scaled to (cols × rows) element boxes so each tile === one box.
// Same value drives CSS `background-size` and Cytoscape `background-width/height`.
export const ATLAS_BG_WIDTH = `${ATLAS_COLS * 100}%`;
export const ATLAS_BG_HEIGHT = `${ATLAS_ROWS * 100}%`;

const index = new Map(manifest.slugs.map((slug, i) => [slug, i] as const));

/** Whether the atlas actually contains a tile for this slug. */
export const hasAtlasCell = (slug: string): boolean => index.has(slug);

/**
 * Percentage background-position of a slug's tile, per axis. Uses the CSS sprite
 * formula `n / (count - 1)` because percentage positioning aligns the n% point
 * of the (oversized) image to the n% point of the box. Unknown slugs pin to the
 * top-left tile; pair with `hasAtlasCell` to hide the image entirely instead.
 */
export function atlasCell(slug: string): { x: number; y: number } {
  const i = index.get(slug) ?? 0;
  const col = i % ATLAS_COLS;
  const row = Math.floor(i / ATLAS_COLS);
  return {
    x: ATLAS_COLS > 1 ? (col / (ATLAS_COLS - 1)) * 100 : 0,
    y: ATLAS_ROWS > 1 ? (row / (ATLAS_ROWS - 1)) * 100 : 0,
  };
}

/** `background-position` shorthand (`x% y%`) for a slug's tile (DOM sprites). */
export function atlasPosition(slug: string): string {
  const { x, y } = atlasCell(slug);
  return `${x}% ${y}%`;
}

/** Warm the browser cache with the one atlas request, best-effort. */
export function preloadAtlas(): void {
  if (typeof window === 'undefined') return;
  const img = new Image();
  img.src = ATLAS_SRC;
}
