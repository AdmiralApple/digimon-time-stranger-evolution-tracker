import type { Core } from 'cytoscape';
import { appData } from '../data/appData';
import { lineage } from '../data/graph';
import type { Route } from '../data/route';
import { FOCUS_PITCH, focusPos, minimizeBandCrossings } from './crossing';
import { genAxis, genLabelPos, orient, spreadAxis, type Orientation } from './orient';
import { centeredSlots, GRAPH_NODE_PITCH, type GraphOrder } from './order';

/** Spread-axis pitch between consecutive steps in the compact route view. */
const ROUTE_PITCH = 150;
/** Generation-axis pitch between the generation levels a route visits. */
const ROUTE_BAND_PITCH = 200;

let orderAnimationRAF = 0;

export function cancelGraphOrderAnimation(): void {
  if (!orderAnimationRAF) return;
  cancelAnimationFrame(orderAnimationRAF);
  orderAnimationRAF = 0;
}

function graphOrderTargets(
  order: GraphOrder,
  selected: string | null,
  orientation: Orientation,
  currentAnchorSlot?: number,
) {
  const { db, graph, layout } = appData();
  const baseline = order === 'connections' ? 'original' : order;
  const bands = new Map<number, string[]>();

  for (const slug of graph.slugs) {
    const gen = layout.positions[slug].x;
    (bands.get(gen) ?? bands.set(gen, []).get(gen)!).push(slug);
  }

  for (const slugs of bands.values()) {
    slugs.sort((a, b) => {
      if (baseline === 'name') {
        return db.digimon[a].name.localeCompare(db.digimon[b].name, undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      }
      if (baseline === 'number') return db.digimon[a].number - db.digimon[b].number;
      return layout.positions[a].y - layout.positions[b].y;
    });
  }

  const slots = new Map<number, Map<string, number>>();
  for (const [gen, slugs] of bands) {
    slots.set(gen, new Map(slugs.map((slug, index) => [slug, index])));
  }

  if (order === 'connections' && selected && layout.positions[selected]) {
    const selectedGen = layout.positions[selected].x;
    const anchorSlot = currentAnchorSlot ?? bands.get(selectedGen)?.indexOf(selected) ?? 0;
    const selectedBand = bands.get(selectedGen);
    // A form may itself have been moved beside the previously selected node.
    // Reserve its CURRENT visual slot before arranging the new neighborhood so
    // following a path never makes the clicked target jump back to baseline.
    if (selectedBand) {
      slots.set(selectedGen, centeredSlots(selectedBand, new Set([selected]), anchorSlot));
    }
    const relatedByGen = new Map<number, Set<string>>();
    const related = [
      ...(graph.inn.get(selected) ?? []),
      ...(graph.out.get(selected) ?? []),
    ];
    for (const slug of related) {
      if (slug === selected || !layout.positions[slug]) continue;
      const gen = layout.positions[slug].x;
      (relatedByGen.get(gen) ?? relatedByGen.set(gen, new Set()).get(gen)!).add(slug);
    }
    for (const [gen, moved] of relatedByGen) {
      const ordered = bands.get(gen);
      if (ordered) slots.set(gen, centeredSlots(ordered, moved, anchorSlot));
    }
  }

  const targets = new Map<string, { x: number; y: number }>();
  for (const [gen, slugs] of bands) {
    const bandSlots = slots.get(gen)!;
    for (const slug of slugs) {
      targets.set(
        slug,
        orient({ x: gen, y: (bandSlots.get(slug) ?? 0) * GRAPH_NODE_PITCH }, orientation),
      );
    }
  }
  return targets;
}

/**
 * Apply the normal atlas ordering. Relationship-aware ordering uses a manual
 * smoothstep lerp so all affected rows glide as one coherent rearrangement,
 * including when a second node is selected before the first move completes.
 */
export function arrangeGraph(
  cy: Core,
  order: GraphOrder,
  selected: string | null,
  orientation: Orientation,
  animate = true,
): void {
  cancelGraphOrderAnimation();
  let currentAnchorSlot: number | undefined;
  if (order === 'connections' && selected) {
    const anchor = cy.$id(selected);
    if (anchor.length) {
      const current = anchor.position();
      const spread = orientation === 'rows' ? current.x : current.y;
      currentAnchorSlot = Math.max(0, Math.round(spread / GRAPH_NODE_PITCH));
    }
  }
  const targets = graphOrderTargets(order, selected, orientation, currentAnchorSlot);
  const movers = cy.nodes().filter((node) => {
    const target = targets.get(node.id());
    if (!target) return false;
    const current = node.position();
    return Math.abs(current.x - target.x) > 0.1 || Math.abs(current.y - target.y) > 0.1;
  });
  if (!movers.length) return;

  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  if (!animate || reduce) {
    cy.batch(() =>
      movers.forEach((node) => {
        node.position(targets.get(node.id())!);
      }),
    );
    cy.emit('layoutstop');
    return;
  }

  const starts = new Map<string, { x: number; y: number }>();
  movers.forEach((node) => {
    starts.set(node.id(), node.position());
  });
  const started = performance.now();
  const duration = 460;
  const tick = (now: number) => {
    const raw = Math.min(1, (now - started) / duration);
    const t = raw * raw * (3 - 2 * raw); // smoothstep easing around the lerp
    cy.batch(() => {
      movers.forEach((node) => {
        const from = starts.get(node.id())!;
        const to = targets.get(node.id())!;
        node.position({
          x: from.x + (to.x - from.x) * t,
          y: from.y + (to.y - from.y) * t,
        });
      });
    });
    if (raw < 1) orderAnimationRAF = requestAnimationFrame(tick);
    else {
      orderAnimationRAF = 0;
      cy.emit('layoutstop');
    }
  };
  orderAnimationRAF = requestAnimationFrame(tick);
}

/**
 * Re-place every node for a new orientation without a rebuild. Digimon nodes
 * carry their base coordinates (`bx`/`by`) and simply transpose; generation
 * labels re-derive their off-band position (and swap alignment via `label-rows`)
 * from the generation coordinate they carry.
 */
export function reorientGraph(cy: Core, orientation: Orientation): void {
  cancelGraphOrderAnimation();
  cy.batch(() => {
    cy.nodes().forEach((n) => {
      if (n.hasClass('col-label')) {
        n.position(genLabelPos(n.data('gen') as number, orientation));
        n[orientation === 'rows' ? 'addClass' : 'removeClass']('label-rows');
      } else {
        n.position(orient({ x: n.data('bx') as number, y: n.data('by') as number }, orientation));
      }
    });
  });
}

/**
 * Compact the focused lineage: keep each member in its own generation band (so
 * the evolution stages still read as bands), but re-pack members within a band
 * tightly and centered, AND collapse the empty stage gaps by re-indexing the
 * present generations to consecutive bands. Only lineage nodes move; everything
 * else is hidden in this mode. Stage order (base generation coordinate) is
 * preserved; within a band, members are re-sequenced to minimise the link
 * crossings on screen, seeded by — and never regressing past — the base order.
 */
export function compactFocus(
  cy: Core,
  focusSlug: string,
  orientation: Orientation,
  excluded: ReadonlySet<string> = new Set(),
): void {
  cancelGraphOrderAnimation();
  const { graph, layout } = appData();
  const lin = lineage(graph, focusSlug, excluded);
  const byGen = new Map<number, string[]>();
  for (const slug of lin.nodes) {
    const base = layout.positions[slug];
    if (!base) continue;
    (byGen.get(base.x) ?? byGen.set(base.x, []).get(base.x)!).push(slug);
  }
  const gens = [...byGen.keys()].sort((a, b) => a - b);
  // Seed each band with the stable base spread order, then reorder to cut crossings.
  for (const g of gens) byGen.get(g)!.sort((a, b) => layout.positions[a].y - layout.positions[b].y);
  const ordered = minimizeBandCrossings(gens, byGen, lin.edges, (s) => layout.positions[s].x);
  cy.batch(() => {
    gens.forEach((genX, band) => {
      const slugs = ordered.get(genX)!;
      slugs.forEach((slug, i) => {
        cy.$id(slug).position(orient(focusPos(band, i, slugs.length), orientation));
      });
    });
  });
}

/**
 * Compact an open route into a clean staircase. Like compactFocus, this exists
 * because otherwise the route's members keep their scattered full-graph
 * positions and the path reads as noise strung across the whole board.
 *
 * The nodes are sequenced along the spread axis in route order (evenly spaced),
 * while the generation axis carries their generation LEVEL — the distinct
 * generations the route visits, re-indexed to consecutive bands (collapsing the
 * full graph's tier gaps, as compactFocus does). So a digivolve reads as a step
 * up a band and a de-digivolve as a step down, consistent with the generation
 * axis everywhere else. A route is a loopless path, so the spread coordinate
 * increases monotonically and the glowing links never cross — no
 * crossing-reduction pass is needed (unlike the branching focus lineage).
 * Only the route's own nodes move; everything else is hidden in this mode.
 */
export function compactRoute(cy: Core, route: Route, orientation: Orientation): void {
  cancelGraphOrderAnimation();
  const { positions } = appData().layout;
  const nodes = [route.from, ...route.steps.map((s) => s.to)];
  const genXs = [
    ...new Set(nodes.map((s) => positions[s]?.x).filter((x): x is number => x !== undefined)),
  ].sort((a, b) => a - b);
  const levelOf = new Map(genXs.map((x, i): [number, number] => [x, i]));
  const mid = (nodes.length - 1) / 2;
  cy.batch(() => {
    nodes.forEach((slug, i) => {
      const base = positions[slug];
      if (!base) return;
      const gen = levelOf.get(base.x)! * ROUTE_BAND_PITCH;
      cy.$id(slug).position(orient({ x: gen, y: (i - mid) * ROUTE_PITCH }, orientation));
    });
  });
}

/**
 * Compact a filtered set the way compactFocus compacts a lineage — but a filter
 * result is an arbitrary subset, not one connected family. So each match keeps
 * its TRUE generation coordinate (the stages stay put and still line up with the
 * generation band shading) while its band is re-packed tightly, closing the wide
 * gaps the hidden non-matches leave behind. Members hold their stable base
 * spread order within a band; there's no lineage to run a crossing pass over.
 * Only the matches move; non-matches are hidden.
 *
 * Members pack from the START of the spread axis (not centred like compactFocus),
 * so a wide band never reaches back into the margin where the generation
 * watermarks sit — matching how the full graph keeps its columns clear of the
 * labels. compactFocus can centre because focus hides the labels; here they stay.
 */
export function compactFilter(
  cy: Core,
  matching: ReadonlySet<string>,
  orientation: Orientation,
): void {
  cancelGraphOrderAnimation();
  const { positions } = appData().layout;
  const byGen = new Map<number, string[]>();
  for (const slug of matching) {
    const base = positions[slug];
    if (!base) continue;
    (byGen.get(base.x) ?? byGen.set(base.x, []).get(base.x)!).push(slug);
  }
  cy.batch(() => {
    for (const [genX, slugs] of byGen) {
      slugs.sort((a, b) => positions[a].y - positions[b].y);
      slugs.forEach((slug, i) => {
        cy.$id(slug).position(orient({ x: genX, y: i * FOCUS_PITCH }, orientation));
      });
    }
  });
}

/**
 * A readable opening slab rather than a fit-all sliver: center the short
 * (generation) axis so the bands are balanced, and pin the long (member-spread)
 * axis to its start so the first members of each band are in view. Works for
 * either orientation.
 *
 * layout.bounds is in the base frame (x = generation extent, y = spread extent);
 * both orientations reuse those extents, just on swapped screen axes.
 */
export function resetView(cy: Core, orientation: Orientation, animate = false): void {
  const { bounds } = appData().layout;
  // Open at a readable zoom where sprites are legible (~0.3 rendered them at a
  // ~22px sliver), anchored at the In-Training / Rookie start — the natural entry
  // into the tree. The graph pans/zooms smoothly from here to the full overview.
  const level = 0.56;
  const gen = genAxis(orientation);
  const spread = spreadAxis(orientation);
  // Generation is always the base-X axis and member spread the base-Y axis,
  // whatever the orientation maps them to on screen; anchor both at their start.
  const pan = {
    [gen]: (orientation === 'rows' ? 86 : 112) - bounds.minX * level,
    // Rows place the stage labels in a left-hand rail. Leave a deliberate label
    // gutter so "In-Training" never opens clipped off-screen.
    [spread]: (orientation === 'rows' ? 210 : 104) - bounds.minY * level,
  } as { x: number; y: number };
  if (animate) {
    cy.animate({ pan, zoom: level, duration: 350, easing: 'ease-out-cubic' });
  } else {
    cy.zoom(level);
    cy.pan(pan);
  }
}
