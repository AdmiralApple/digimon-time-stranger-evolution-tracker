import { attrClass, ATTRIBUTE_COLORS, type GraphPalette } from '../theme/attribute';
import { ATTRIBUTE_KEYS } from '../data/schema';
import { ATLAS_BG_HEIGHT, ATLAS_BG_WIDTH, ATLAS_SRC } from '../data/atlas';

// cytoscape's bundled types lag behind real style properties (underlay-*,
// min-zoomed-font-size, line-dash-pattern...) — keep rules loosely typed and
// cast once at cytoscape() init.
interface StyleRule {
  selector: string;
  style: Record<string, unknown>;
}

/**
 * Class-driven stylesheet — classes are stamped once at load; class selectors
 * are cached by cytoscape, unlike per-render function mappers.
 *
 * Dim layers (precedence encoded by stylesheet ORDER, later wins):
 *   .dim-filter (0.12) < .dim-soft (0.45 selection context) < .dim-hard (0.08 focus)
 *   < .route-dim < .route-glow < :selected
 */
export function buildStylesheet(palette: GraphPalette): StyleRule[] {
  const styles: StyleRule[] = [
    {
      selector: 'core',
      style: {
        // Cytoscape's default pressed-background indicator is a circular flash.
        // The canvas already has clear hover/selection feedback, so keep empty
        // graph taps visually quiet.
        'active-bg-opacity': 0,
        'active-bg-size': 0,
        'selection-box-opacity': 0,
      },
    },
    {
      selector: 'node',
      style: {
        width: 76,
        height: 76,
        shape: 'round-rectangle',
        'corner-radius': 9,
        'background-color': palette.surface2,
        // All nodes share ONE background image (the atlas), so cytoscape loads it
        // once; each node shows its own tile by scaling the sheet up to the full
        // grid and shifting it with data(bgx/bgy) — the sprite trick on canvas.
        'background-image': ATLAS_SRC,
        'background-fit': 'none',
        'background-repeat': 'no-repeat',
        'background-width': ATLAS_BG_WIDTH,
        'background-height': ATLAS_BG_HEIGHT,
        'background-image-containment': 'over',
        'background-clip': 'node',
        'background-position-x': 'data(bgx)',
        'background-position-y': 'data(bgy)',
        'background-opacity': 1,
        'border-width': 1.5,
        'border-color': palette.border,
        label: 'data(name)',
        color: palette.textDim,
        'font-family': 'Hanken Grotesk, system-ui, sans-serif',
        'font-size': 11,
        'font-weight': 700,
        'min-zoomed-font-size': 8,
        'text-valign': 'bottom',
        'text-halign': 'center',
        'text-margin-y': 5,
        'text-background-color': palette.bg,
        'text-background-opacity': 0.9,
        'text-background-padding': '3px',
        'text-background-shape': 'roundrectangle',
      },
    },
    // attribute-colored borders + placeholder fill
    ...ATTRIBUTE_KEYS.map((attribute) => ({
      selector: `node.${attrClass(attribute)}`,
      style: { 'border-color': ATTRIBUTE_COLORS[attribute] },
    })),
    {
      selector: 'node.gen-armor',
      style: { 'border-style': 'double', 'border-width': 4 },
    },
    {
      selector: 'node.gen-hybrid',
      style: { 'border-style': 'dashed' },
    },
    {
      selector: 'node.col-label',
      style: {
        'background-opacity': 0,
        'border-width': 0,
        width: 1,
        height: 1,
        label: 'data(name)',
        color: palette.colLabel,
        'text-opacity': palette.colLabelOpacity,
        'font-family': 'Hanken Grotesk, system-ui, sans-serif',
        'font-size': 46,
        'font-weight': 700,
        'text-transform': 'uppercase',
        'min-zoomed-font-size': 0,
        'text-valign': 'center',
        'text-halign': 'center',
        'text-background-opacity': 0,
        events: 'no',
      },
    },
    {
      // row orientation: labels sit in the left margin; text runs leftward so
      // long generation names never overlap their band's members
      selector: 'node.col-label.label-rows',
      style: {
        'font-size': 32,
        'text-halign': 'left',
        'text-valign': 'center',
        'text-margin-x': -8,
      },
    },
    {
      selector: 'edge',
      style: {
        // The overview is node-first: all 1,120 relationships form a quiet
        // structural layer. Direction appears only while inspecting a link.
        width: 1,
        'curve-style': 'straight',
        'line-color': palette.edge,
        'line-opacity': palette.edgeOpacity,
        'target-arrow-shape': 'none',
        'target-arrow-color': palette.edge,
        'arrow-scale': 0.8,
        // Connections are visual explanations, never interaction targets. This
        // also lets an empty-space tap pass through as a graph-background tap.
        events: 'no',
      },
    },
    {
      selector: 'edge.parallel',
      style: {
        'curve-style': 'bezier',
        'control-point-step-size': 28,
      },
    },
    {
      selector: 'edge.e-jogress',
      style: { 'line-color': palette.jogress, 'target-arrow-color': palette.jogress, 'line-style': 'dashed', 'line-opacity': 0.16 },
    },
    {
      selector: 'edge.e-item',
      style: { 'line-color': palette.item, 'target-arrow-color': palette.item, 'line-style': 'dashed', 'line-dash-pattern': [2, 4], 'line-opacity': 0.16 },
    },
    {
      selector: 'edge.e-bond',
      style: { 'line-color': palette.bond, 'target-arrow-color': palette.bond, 'line-style': 'dashed', 'line-opacity': 0.16 },
    },
    // Do not draw unexplained half-links to nodes far outside the camera. Hover,
    // selection, focus and route rules appear later and intentionally override it.
    { selector: 'edge.edge-offscreen', style: { 'line-opacity': 0 } },
    // Optional node-only overview. This rule intentionally precedes every
    // explanatory path state so active relationships still override it.
    { selector: 'edge.path-ghosts-hidden', style: { 'line-opacity': 0 } },
    // One-hop preview for mouse users. Keep these before every persistent state
    // layer so a stale hover can never override selection, focus, or a route.
    {
      selector: 'edge.hover-next',
      style: {
        'line-color': palette.routeEvolve,
        'target-arrow-color': palette.routeEvolve,
        'target-arrow-shape': 'triangle',
        'line-opacity': 1,
        width: 2.5,
        'z-index': 9,
      },
    },
    {
      selector: 'edge.hover-prev',
      style: {
        'line-color': palette.accent2,
        'target-arrow-color': palette.accent2,
        'target-arrow-shape': 'triangle',
        'line-opacity': 1,
        width: 2.5,
        'z-index': 9,
      },
    },
    {
      selector: 'node.hover-neighbor',
      style: {
        opacity: 1,
        'border-width': 2,
        'text-opacity': 1,
        color: palette.text,
        'z-index': 7,
      },
    },
    // hover feedback: a soft halo in the node's OWN signature colour, so
    // brushing a Digimon previews the hue the whole UI will take on selection.
    {
      selector: 'node.hover',
      style: {
        'underlay-color': 'data(accent)',
        'underlay-opacity': 0.2,
        'underlay-padding': 6,
        'text-opacity': 1,
        color: palette.text,
        'z-index': 6,
      },
    },
    // --- dim/highlight layers, order = precedence ---
    { selector: 'node.dim-filter', style: { opacity: 0.12 } },
    { selector: 'edge.dim-filter', style: { 'line-opacity': 0.05, opacity: 0.3 } },
    { selector: 'node.dim-soft', style: { opacity: 0.45 } },
    { selector: 'edge.dim-soft', style: { 'line-opacity': 0.012 } },
    { selector: 'node.dim-hard', style: { opacity: 0.08 } },
    { selector: 'edge.dim-hard', style: { 'line-opacity': 0.02, opacity: 0.2 } },
    // focus "hide others" — remove non-lineage elements from the scene entirely
    { selector: '.hidden', style: { display: 'none' } },
    // fog-of-war: an undiscovered Digimon on the frontier of what you've met —
    // a dim, nameless silhouette (no sprite) that says "something evolves here"
    // without spoiling which. Its hinting edge is faint and dashed.
    {
      selector: 'node.fog',
      style: {
        'background-image': 'none',
        'background-color': palette.surface2,
        'background-opacity': 1,
        'border-color': palette.border,
        'border-width': 2,
        'border-style': 'dashed',
        opacity: 0.42,
        label: '?',
        color: palette.colLabel,
        'text-opacity': 0.85,
        'font-size': 26,
        'font-weight': 800,
        'text-valign': 'center',
        'text-halign': 'center',
        'text-margin-y': 0,
        'text-background-opacity': 0,
        events: 'yes',
      },
    },
    { selector: 'edge.fog-edge', style: { 'line-opacity': 0.12, 'line-style': 'dashed', opacity: 0.4 } },
    // Clicking a silhouette answers why it is visible without disclosing its
    // identity: brighten only the revealed neighbours and their direct links.
    {
      selector: 'node.frontier-active',
      style: {
        opacity: 0.78,
        'border-color': palette.accent,
        'border-width': 3,
        'underlay-color': palette.accent,
        'underlay-opacity': 0.18,
        'underlay-padding': 8,
        'z-index': 8,
      },
    },
    {
      selector: 'node.frontier-neighbor',
      style: {
        opacity: 1,
        'border-width': 3,
        'text-opacity': 1,
        color: palette.text,
        'underlay-color': palette.accent,
        'underlay-opacity': 0.2,
        'underlay-padding': 7,
        'z-index': 8,
      },
    },
    {
      selector: 'edge.frontier-next',
      style: {
        'line-color': palette.routeEvolve,
        'target-arrow-color': palette.routeEvolve,
        'target-arrow-shape': 'triangle',
        'line-opacity': 1,
        opacity: 1,
        width: 3,
        'line-style': 'solid',
        'z-index': 9,
      },
    },
    {
      selector: 'edge.frontier-prev',
      style: {
        'line-color': palette.accent2,
        'target-arrow-color': palette.accent2,
        'target-arrow-shape': 'triangle',
        'line-opacity': 1,
        opacity: 1,
        width: 3,
        'line-style': 'solid',
        'z-index': 9,
      },
    },
    // lineage highlight, split by direction relative to the anchor Digimon:
    // where it evolves TO (next, amber) vs where it comes FROM (previous, cyan)
    {
      selector: 'edge.lineage-next',
      style: {
        'line-color': palette.routeEvolve,
        'target-arrow-color': palette.routeEvolve,
        'target-arrow-shape': 'triangle',
        'line-opacity': 1,
        width: 3,
        'z-index': 8,
      },
    },
    {
      selector: 'edge.lineage-prev',
      style: {
        'line-color': palette.accent2,
        'target-arrow-color': palette.accent2,
        'target-arrow-shape': 'triangle',
        'line-opacity': 1,
        width: 3,
        'z-index': 8,
      },
    },
    // in the isolated focus view, ancestry links read a touch thinner than
    // the descendant links (later rule → wins the width for prev edges)
    {
      selector: 'edge.lineage-prev-thin',
      style: { width: 2 },
    },
    // an active filter greys out the non-matching Digimon; a highlighted lineage
    // arrow into/out of one of them must fade to match (this rule follows the
    // lineage colours so it wins their line-opacity, but precedes the route
    // layers so a route's own glowing edges are never muted).
    {
      selector: 'edge.filter-mute',
      style: { opacity: 0.14, 'line-opacity': 0.5, 'z-index': 1 },
    },
    { selector: 'node.route-dim', style: { opacity: 0.1 } },
    { selector: 'edge.route-dim', style: { 'line-opacity': 0.03 } },
    {
      selector: 'edge.route-glow',
      style: {
        'line-color': palette.routeEvolve,
        'target-arrow-color': palette.routeEvolve,
        'target-arrow-shape': 'triangle',
        'line-opacity': 1,
        width: 4,
        'z-index': 10,
        'line-style': 'solid',
      },
    },
    {
      selector: 'edge.route-glow-devolve',
      style: {
        'line-color': palette.routeDevolve,
        'target-arrow-color': palette.routeDevolve,
        'line-style': 'dashed',
        'line-opacity': 1,
        width: 4,
        'z-index': 10,
        'source-arrow-shape': 'triangle',
        'source-arrow-color': palette.routeDevolve,
        'target-arrow-shape': 'none',
      },
    },
    {
      selector: 'node.route-node',
      style: { opacity: 1, 'z-index': 11 },
    },
    {
      // the live (hovered) step reads as a charged conduit: dashed so the
      // controller's rAF can march the pattern toward the goal (line-dash-offset)
      selector: 'edge.route-step-active',
      style: { width: 7, 'line-style': 'dashed', 'line-dash-pattern': [9, 7], 'z-index': 12 },
    },
    {
      // custom class instead of :selected — the store is the single source of
      // truth for selection (native cy selection is disabled). Border + glow are
      // the *Digimon's own* signature colour (data(accent)), so the graph lights
      // up in the character's hue.
      selector: 'node.sel',
      style: {
        opacity: 1,
        'border-width': 2.5,
        'border-color': 'data(accent)',
        'underlay-color': 'data(accent)',
        'underlay-opacity': 0.3,
        'underlay-padding': 8,
        'z-index': 12,
        color: palette.text,
        'text-opacity': 1,
      },
    },
  ];
  return styles;
}
