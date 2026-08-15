import type { ElementDefinition } from 'cytoscape';
import type { AppData } from '../data/appData';
import { atlasCell } from '../data/atlas';
import { classifyForwardEdge, type ForwardStepClass } from '../data/route';
import { edgeKey } from '../data/graph';
import type { Generation } from '../data/schema';
import { attrClass } from '../theme/attribute';
import { nodeAccentHex } from '../theme/chroma';
import { genLabelPos, orient, type Orientation } from './orient';

// Tier index used to detect tier-skip edges (rendered as arcs so they don't
// shoot straight through intermediate columns). Mirrors the layout script.
const TIER: Partial<Record<Generation, number>> = {
  'In-Training I': 0,
  'In-Training II': 1,
  'Rookie': 2,
  'Champion': 3,
  'Armor': 3,
  'Ultimate': 4,
  'Mega': 5,
  'Mega +': 6,
};

export function buildElements(data: AppData, orientation: Orientation): ElementDefinition[] {
  const { graph, layout } = data;
  const elements: ElementDefinition[] = [];
  // `bx`/`by` carry the base (column-frame) coordinates so orientation can be
  // re-applied live without recomputing anything (see reorientGraph).
  const labelClass = orientation === 'rows' ? 'col-label label-rows' : 'col-label';

  for (const slug of graph.slugs) {
    const d = graph.db.digimon[slug];
    const classes = [attrClass(d.attribute)];
    if (d.generation === 'Armor') classes.push('gen-armor');
    if (d.generation === 'Hybrid') classes.push('gen-hybrid');
    const base = layout.positions[slug];
    // bgx/bgy address this node's tile in the shared atlas (see stylesheet.ts).
    const cell = atlasCell(slug);
    elements.push({
      group: 'nodes',
      data: {
        id: slug,
        name: d.name,
        bgx: `${cell.x}%`,
        bgy: `${cell.y}%`,
        accent: nodeAccentHex(slug),
        bx: base.x,
        by: base.y,
      },
      position: orient(base, orientation),
      classes: classes.join(' '),
    });
  }

  // floating generation headers + hybrid section label (non-interactive).
  // `bx`/`by` here are the label's chosen base position for the current
  // orientation, kept for reorientGraph to re-place them.
  const labels: Array<{ id: string; name: string; gen: number }> = [
    ...layout.columns.map((column, i) => ({
      id: `__col-${i}`,
      name: column.generations.join(' / '),
      gen: column.x,
    })),
    { id: '__col-hybrid', name: layout.hybridLane.label, gen: layout.hybridLane.x },
  ];
  for (const { id, name, gen } of labels) {
    const pos = genLabelPos(gen, orientation);
    // Labels paint no sprite (background-opacity 0) but still carry bgx/bgy so
    // the base node's shared background-position mapper never sees missing data.
    elements.push({
      group: 'nodes',
      data: { id, name, bx: pos.x, by: pos.y, gen, bgx: '0%', bgy: '0%' },
      position: pos,
      classes: labelClass,
      selectable: false,
    });
  }

  for (const from of graph.slugs) {
    for (const to of graph.out.get(from) ?? []) {
      const classes: string[] = [];
      const cls: ForwardStepClass = classifyForwardEdge(graph, from, to);
      if (cls === 'jogress') classes.push('e-jogress');
      else if (cls === 'item') classes.push('e-item');
      else if (graph.db.digimon[to].evolutionCondition.agentSkills) classes.push('e-bond');

      const isTwoCycle = (graph.out.get(to) ?? []).includes(from);
      const fromTier = TIER[graph.db.digimon[from].generation];
      const toTier = TIER[graph.db.digimon[to].generation];
      const isTierSkip =
        fromTier !== undefined && toTier !== undefined && Math.abs(toTier - fromTier) > 1;
      if (isTwoCycle || isTierSkip) classes.push('parallel');

      elements.push({
        group: 'edges',
        data: { id: edgeKey(from, to), source: from, target: to },
        classes: classes.join(' '),
      });
    }
  }

  return elements;
}
