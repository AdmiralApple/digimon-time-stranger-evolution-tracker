import type { LayoutData } from '../data/appData';

/** One generation stage as a range on the generation axis (base-frame coords). */
export interface Band {
  lo: number;
  hi: number;
  /** Whether this stage gets the alternating shade (every other stage). */
  tint: boolean;
}

/**
 * Tile the generation axis into one section per visual stage so the graph can
 * shade alternating stages. Sections come from the committed layout columns —
 * which already fold Armor into the Champion band (shared partition) — plus the
 * Hybrid lane as a single trailing section: it spans several depth-columns along
 * the generation axis but reads as one stage ("after Mega +").
 *
 * Boundaries sit at the midpoints between consecutive stage centres, so the
 * shading is gapless; the two outer edges extend half a column-pitch past the
 * end stages. Coordinates are the BASE generation coordinate (a node's base.x),
 * which — because `orient` only swaps axes, never scales — equals the model
 * coordinate on genAxis(orientation). So the layer just needs to know which
 * screen axis is the generation axis; the ranges are orientation-independent.
 */
export function computeBands(layout: LayoutData): Band[] {
  const centres = [
    ...layout.columns.map((c) => c.x),
    // hybrid stage centre = middle of its depth-column span
    (layout.hybridLane.x + layout.bounds.maxX) / 2,
  ].sort((a, b) => a - b);

  const pitch = centres.length > 1 ? centres[1] - centres[0] : 460;
  const bounds = [centres[0] - pitch / 2];
  for (let i = 1; i < centres.length; i++) bounds.push((centres[i - 1] + centres[i]) / 2);
  bounds.push(layout.bounds.maxX + pitch / 2);

  return centres.map((_, i) => ({ lo: bounds[i], hi: bounds[i + 1], tint: i % 2 === 0 }));
}
