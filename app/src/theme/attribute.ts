import type { Attribute } from '../data/schema';
import type { Theme } from './theme';

/** Single source of truth for attribute colors — consumed by the cytoscape
 *  stylesheet AND injected as CSS custom properties on boot. Retuned in OKLCH
 *  for maximal mutual separation (the graph pairs each with a shape badge so
 *  colour is never the sole channel). Tuned to read on the dark graph viewport
 *  and as dots/borders in either chrome theme. */
export const ATTRIBUTE_COLORS: Record<Attribute, string> = {
  'Vaccine': '#3496ef', // blue    L0.66 H250
  'Data': '#4cb86a', // green   L0.70 H150
  'Virus': '#ac5cd7', // violet  L0.62 H312
  'Free': '#d7ab28', // gold    L0.76 H88
  'Variable': '#ee5b9a', // pink    L0.68 H357
  'Unknown': '#8594a4', // slate   L0.66 H250
  'No Data': '#65707b', // d.slate L0.54 H250
};

/** Graph palette — every colour the Cytoscape viewport paints, keyed by chrome
 *  theme. Cytoscape needs concrete values (it can't read CSS custom properties),
 *  so the two stages live here rather than in tokens.css and are re-applied on
 *  theme change (see GraphCanvas). Both stages are built to let the sprites and
 *  their chromatic glow lead:
 *    • dark  — a warm near-black "Digital World" at night.
 *    • light — the same world in daylight: warm parchment, not clinical white
 *              (stark #fff blows out the sprites); bright card fills so each
 *              Digimon still reads as raised, with edges/route colours darkened
 *              to hold their structure on paper. */
export interface GraphPalette {
  bg: string; // graph backdrop + node-label plate
  surface: string;
  surface2: string; // node fill
  border: string; // node border fallback / quiet edge
  text: string;
  textDim: string; // node labels
  edge: string;
  edgeOpacity: number; // base (context) edge opacity — lower on light so the full-graph lineage web doesn't read as a busy cross-hatch on parchment
  accent: string;
  accent2: string; // ancestry (evolves-from) lineage links
  routeEvolve: string; // glowing evolve path / descendant lineage links
  routeDevolve: string; // cool de-evolve path
  jogress: string;
  item: string;
  bond: string;
  colLabel: string; // giant ghosted generation watermark
  colLabelOpacity: number;
  band: string; // alternating generation-stage shading (full-graph view)
  bandOpacity: number;
}

export const GRAPH_PALETTES: Record<Theme, GraphPalette> = {
  dark: {
    bg: '#0c0907',
    surface: '#191714',
    surface2: '#24211e',
    border: '#413c38',
    text: '#f0eeeb',
    textDim: '#aeaaa5',
    edge: '#5a544e',
    edgeOpacity: 0.5,
    accent: '#f5b845', // default brand amber (per-node glow overrides via data)
    accent2: '#45bcd6',
    routeEvolve: '#f5b845',
    routeDevolve: '#9ba6b1',
    jogress: '#a867e7',
    item: '#f48d2f',
    bond: '#45bcd6',
    colLabel: '#f0eeeb',
    colLabelOpacity: 0.42,
    band: '#f0eeeb', // faint warm-white wash lifts the shaded stages off the near-black
    bandOpacity: 0.065,
  },
  light: {
    bg: '#ece7dd', // warm parchment — matches --graph-bg (light)
    surface: '#f4efe7',
    surface2: '#fdfbf7', // bright card so sprites sit on clean ground
    border: '#c3baac',
    text: '#2b2721',
    textDim: '#6b6459',
    edge: '#857b6a', // warm graphite line
    edgeOpacity: 0.32, // quieter on parchment — at 0.5 the full-graph lineage web read as a busy grey cross-hatch
    accent: '#c07f0d',
    accent2: '#1c86a3', // deep cyan ancestry links
    routeEvolve: '#b9790a', // deep ochre-amber path, saturated for paper
    routeDevolve: '#5f6b78', // muted slate de-evolve
    jogress: '#7d3fc0',
    item: '#c2650f',
    bond: '#1c86a3',
    colLabel: '#a89e8f', // warm-grey watermark
    colLabelOpacity: 0.62,
    band: '#4a4336', // warm graphite wash darkens the shaded stages on parchment
    bandOpacity: 0.09,
  },
};

/** attribute → cytoscape node class (e.g. "No Data" → "attr-no-data"). Shared by
 *  the stylesheet (which builds the `node.attr-*` selectors) and elements (which
 *  stamps the classes onto nodes), so the two can never drift out of sync. */
export const attrClass = (attribute: string): string =>
  `attr-${attribute.toLowerCase().replace(/\s+/g, '-')}`;
