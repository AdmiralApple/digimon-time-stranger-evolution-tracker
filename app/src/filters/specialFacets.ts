import type { SpecialFacet } from '../data/search';

/**
 * The "trait" facets shared by the Tree filter bar and the Field Guide's
 * advanced filters — one definition so both surfaces read identically (same
 * glyphs, labels, and tooltips). Order is the canonical filter order.
 */
export const SPECIAL_FACETS: Array<{ key: SpecialFacet; label: string; title: string }> = [
  { key: 'ridable', label: '🐎 Ridable', title: '189 ridable Digimon' },
  { key: 'item', label: '◆ Item', title: 'Requires an item to evolve into (18)' },
  { key: 'jogress', label: '⧉ Jogress/DNA', title: 'Jogress/DNA fusion (17)' },
  { key: 'bond', label: '❖ Bond', title: 'Bond form — Agent Skills requirement (11)' },
];
