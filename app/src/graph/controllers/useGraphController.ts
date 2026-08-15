import { useEffect } from 'react';
import { appData } from '../../data/appData';
import { descendants, edgeKey, lineage } from '../../data/graph';
import { filterSlugs, hasActiveCriteria } from '../../data/search';
import { revealedSet, useStore, type AppState } from '../../state/store';
import { getCy } from '../cyInstance';
import { compactFilter, compactFocus, compactRoute, reorientGraph, resetView } from '../viewport';
import type { Core } from 'cytoscape';

const APPEARANCE_CLASSES =
  'sel dim-soft dim-hard dim-filter hidden fog fog-edge lineage-next lineage-prev lineage-prev-thin filter-mute route-dim route-glow route-glow-devolve route-node route-step-active';

const NO_EXCLUSIONS: ReadonlySet<string> = new Set();

const prefersReduce = (): boolean =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * One-shot "lock-on" when a Digimon is selected: its underlay glow blooms and
 * settles, in the character's own signature colour (the .sel underlay uses
 * data(accent)). Purely acknowledgement — no layout, no lasting state.
 */
let lastPulsed: string | null = null;
function clearPulse(cy: ReturnType<typeof getCy>): void {
  if (!cy || !lastPulsed) return;
  const prev = cy.$id(lastPulsed);
  if (prev.length) {
    prev.stop();
    prev.removeStyle('underlay-padding underlay-opacity');
  }
  lastPulsed = null;
}
function pulseSelection(slug: string): void {
  const cy = getCy();
  if (!cy || prefersReduce()) return;
  clearPulse(cy); // kill any lingering glow on the previously-selected node
  const node = cy.$id(slug);
  if (!node.length || node.hasClass('col-label')) return;
  lastPulsed = slug;
  node
    .animate({ style: { 'underlay-padding': 22, 'underlay-opacity': 0.5 } }, {
      duration: 150,
      easing: 'ease-out-quad',
    })
    .animate({ style: { 'underlay-padding': 10, 'underlay-opacity': 0.3 } }, {
      duration: 480,
      easing: 'ease-out-cubic',
      complete: () => node.removeStyle('underlay-padding underlay-opacity'),
    });
}

// Marching-ants flow along the live (hovered) route step, throttled to ~30fps
// so a single dashed edge redraw never competes with interaction. Only runs
// while a step is active and motion is allowed.
let flowRAF = 0;
let flowOffset = 0;
let flowLast = 0;
function manageRouteFlow(): void {
  if (flowRAF) {
    cancelAnimationFrame(flowRAF);
    flowRAF = 0;
  }
  const cy = getCy();
  if (!cy || prefersReduce()) return;
  const edges = cy.edges('.route-step-active');
  if (!edges.length) return;
  const tick = (t: number) => {
    if (t - flowLast >= 33) {
      flowLast = t;
      flowOffset -= 1.4;
      edges.style('line-dash-offset', flowOffset);
    }
    flowRAF = requestAnimationFrame(tick);
  };
  flowRAF = requestAnimationFrame(tick);
}

/**
 * Move the `route-step-active` highlight to the currently hovered step's edge.
 * Split out of the full appearance recompute so brushing across route steps
 * only re-stamps one class instead of re-deriving the focus lineage, filter and
 * route layers over ~475 nodes / ~1120 edges on every mouseenter/leave.
 */
function updateActiveStep(state: AppState): void {
  const cy = getCy();
  if (!cy) return;
  cy.batch(() => {
    cy.edges('.route-step-active').removeClass('route-step-active');
    const route = state.routeOpen ? state.route.routes?.[state.route.active] : undefined;
    const idx = state.route.activeStep;
    if (!route || idx === null) return;
    const step = route.steps[idx];
    if (!step) return;
    // a dedigivolve step from u to v travels the forward edge v->u
    const id = step.kind === 'digivolve' ? edgeKey(step.from, step.to) : edgeKey(step.to, step.from);
    cy.$id(id).addClass('route-step-active');
  });
}

/**
 * Highlight the lineage of `anchor`: nodes/edges outside it get `outsideClass`
 * (hidden / dim-hard / dim-soft), while edges inside are coloured by direction —
 * `lineage-next` for edges leading away from the anchor toward its descendants
 * (evolves-to), `lineage-prev` for edges from its ancestors (evolves-from).
 */
function paintLineage(
  cy: Core,
  anchor: string,
  outsideClass: string,
  excluded: ReadonlySet<string>,
  thinPrev = false,
): void {
  const graph = appData().graph;
  const lin = lineage(graph, anchor, excluded);
  const forward = descendants(graph, anchor, excluded); // reachable via evolves-to
  cy.nodes().forEach((n) => {
    if (!lin.nodes.has(n.id())) n.addClass(outsideClass);
  });
  cy.edges().forEach((e) => {
    const source = e.source().id();
    if (!lin.nodes.has(source) || !lin.nodes.has(e.target().id())) {
      e.addClass(outsideClass);
      return;
    }
    if (source === anchor || forward.has(source)) e.addClass('lineage-next');
    else e.addClass(thinPrev ? 'lineage-prev lineage-prev-thin' : 'lineage-prev');
  });
}

/**
 * Fog-of-war base layer. When discovery mode is on, everything you haven't met
 * in-game is hidden; the undiscovered Digimon directly adjacent to something
 * you *have* met surface as nameless "?" silhouettes (the frontier), and an
 * evolution edge shows only once both of its endpoints are revealed. This runs
 * before the focus/filter/selection layers so those only ever act on what's
 * already visible.
 */
function paintFog(cy: Core, state: AppState): void {
  const { mode, frontier } = state.discovery;
  if (!mode) return;
  const graph = appData().graph;
  const revealed = revealedSet(state.discovery);

  // Frontier = undiscovered neighbours (either direction) of a revealed node.
  const frontierSet = new Set<string>();
  if (frontier) {
    for (const slug of revealed) {
      for (const nb of graph.out.get(slug) ?? []) if (!revealed.has(nb)) frontierSet.add(nb);
      for (const nb of graph.inn.get(slug) ?? []) if (!revealed.has(nb)) frontierSet.add(nb);
    }
  }

  cy.nodes().forEach((n) => {
    if (n.hasClass('col-label')) return; // generation headers always show
    const id = n.id();
    if (revealed.has(id)) return;
    n.addClass(frontierSet.has(id) ? 'fog' : 'hidden');
  });
  cy.edges().forEach((e) => {
    const s = e.source().id();
    const t = e.target().id();
    const sr = revealed.has(s);
    const tr = revealed.has(t);
    if (sr && tr) return; // fully revealed edge — leave to the normal layers
    // one end revealed, the other a frontier silhouette → faint dashed hint
    if ((sr && frontierSet.has(t)) || (tr && frontierSet.has(s))) e.addClass('fog-edge');
    else e.addClass('hidden');
  });
}

/**
 * Single appearance controller: recomputes every class layer in one batch on
 * any relevant state change. Precedence is encoded by stylesheet order
 * (dim-filter < dim-soft < dim-hard < route layers < .sel), so stacking
 * classes is safe — no cross-controller races, and a full pass over 475
 * nodes + 1120 edges is ~ms.
 */
function recompute(state: AppState): void {
  const cy = getCy();
  if (!cy) return;
  const db = appData().db;

  cy.batch(() => {
    cy.elements().removeClass(APPEARANCE_CLASSES);

    // fog-of-war base layer: hide/silhouette the undiscovered before anything else.
    paintFog(cy, state);

    // focus layer: isolate the lineage. `hideOthers` removes everything else
    // outright (display:none); otherwise it's hard-dimmed to a faint context.
    // Inside the lineage, edges are coloured by direction relative to the anchor.
    if (state.focus) {
      // in the isolated (hide) focus view, de-emphasise the ancestry links a touch.
      // Excluded branches are pruned from the lineage entirely (treated as absent).
      paintLineage(
        cy,
        state.focus,
        state.hideOthers ? 'hidden' : 'dim-hard',
        state.lineageExcluded,
        state.hideOthers,
      );
    } else if (state.selected) {
      // soft lineage highlight only outside focus mode — shows the full family
      // (branch-pruning is a focus-mode tool, so no exclusions here)
      paintLineage(cy, state.selected, 'dim-soft', NO_EXCLUSIONS);
    }

    // filter layer. In the normal tree view a filter isolates: non-matches are
    // hidden outright (frameGraph then re-packs the matches). Inside focus /
    // route that mode already owns the layout, so filters only grey out
    // (dim-filter, weaker than dim-hard by stylesheet order). Generation
    // watermarks are never touched — they label the stages in every mode.
    const criteria = {
      attributes: state.attributes,
      special: state.special,
      personalities: state.personalities,
    };
    if (hasActiveCriteria(criteria)) {
      const matching = filterSlugs(db, criteria);
      const isolating = Boolean(state.focus) || state.routeOpen;
      const outside = isolating ? 'dim-filter' : 'hidden';
      cy.nodes().forEach((n) => {
        if (!n.hasClass('col-label') && !matching.has(n.id())) n.addClass(outside);
      });
      // A highlighted lineage arrow touching a greyed-out node should fade with
      // it, not stay loud. (Only the lineage highlight — route glow is left be,
      // and non-focus context edges are already dimmed by their own layer.)
      if (isolating) {
        cy.edges('.lineage-next, .lineage-prev').forEach((e) => {
          if (!matching.has(e.source().id()) || !matching.has(e.target().id())) {
            e.addClass('filter-mute');
          }
        });
      }
    }

    // route layer: route elements at full strength, everything else either
    // hidden (display:none) or dimmed, per the `hideOthers` preference
    const route = state.routeOpen ? state.route.routes?.[state.route.active] : undefined;
    if (route && route.steps.length) {
      const outside = state.hideOthers ? 'hidden' : 'route-dim';
      cy.elements().addClass(outside);
      route.steps.forEach((step, i) => {
        // a dedigivolve step from u to v travels the forward edge v->u
        const id =
          step.kind === 'digivolve' ? edgeKey(step.from, step.to) : edgeKey(step.to, step.from);
        const edge = cy.$id(id);
        edge.removeClass(outside);
        edge.addClass(step.kind === 'digivolve' ? 'route-glow' : 'route-glow-devolve');
        if (i === state.route.activeStep) edge.addClass('route-step-active');
        cy.$id(step.from).removeClass(outside).addClass('route-node');
        cy.$id(step.to).removeClass(outside).addClass('route-node');
      });
    }

    if (state.selected) cy.$id(state.selected).addClass('sel');
  });
}

function fitEles(cy: Core, slugs: Set<string>, padding: number, animate: boolean): void {
  const eles = cy.nodes().filter((n) => slugs.has(n.id()));
  if (!eles.length) return;
  if (animate) cy.animate({ fit: { eles, padding }, duration: 350, easing: 'ease-out-cubic' });
  else cy.fit(eles, padding);
}

/**
 * Pan (and zoom) so a node sits at the viewport centre. Derives the pan from the
 * node's model position rather than `zoom: { position }` — the latter only zooms
 * ABOUT a point and leaves the pan untouched, so when we frame a selection after
 * leaving route / focus (viewport still parked on the old compact staircase) the
 * node stays off-screen and the whole graph reads as panned into empty space.
 */
function centerNode(cy: Core, node: ReturnType<Core['$id']>, zoom: number, animate: boolean): void {
  const p = node.position();
  const pan = { x: cy.width() / 2 - p.x * zoom, y: cy.height() / 2 - p.y * zoom };
  if (animate) cy.animate({ zoom, pan, duration: 350, easing: 'ease-out-cubic' });
  else {
    cy.zoom(zoom);
    cy.pan(pan);
  }
}

/**
 * Position + viewport are a function of orientation × focus × route, so they're
 * recomputed together whenever any of those change:
 *   • focused + "hide others" → compact the lineage tight and frame it
 *   • focused + "dim others"  → lineage in place (full graph), framed
 *   • route open              → frame the route path
 *   • filtered (normal view)  → compact the matches into their bands, framed
 *   • otherwise               → anchor the selection, or the opening slab
 */
function frameGraph(cy: Core, animate = true): void {
  const state = useStore.getState();
  const o = state.orientation;
  // Under reduced motion the camera jumps to its target instead of gliding — the
  // fit/pan/zoom moves below are decorative travel, not state the user must see.
  const anim = animate && !prefersReduce();
  const route = state.routeOpen ? state.route.routes?.[state.route.active] : undefined;

  if (state.focus) {
    if (state.hideOthers) compactFocus(cy, state.focus, o, state.lineageExcluded);
    else reorientGraph(cy, o);
    fitEles(cy, lineage(appData().graph, state.focus, state.lineageExcluded).nodes, 60, anim);
    return;
  }

  if (route && route.steps.length) {
    // Route mirrors focus: "hide others" compacts the path into a tight
    // staircase, "dim others" leaves it in place within the full graph.
    if (state.hideOthers) compactRoute(cy, route, o);
    else reorientGraph(cy, o);
    fitEles(cy, new Set([route.from, ...route.steps.map((s) => s.to)]), 80, anim);
    return;
  }

  reorientGraph(cy, o);

  // Route planner open but no path to frame — no endpoints yet, no route at the
  // chosen agent rank, or from === to (0 steps). Show the whole tree, exactly as
  // when the planner first opens, so the user keeps their bearings. Without this
  // we'd fall through to the selection anchor below and pan the viewport onto a
  // stale position, parking the graph in empty space.
  if (state.routeOpen) {
    resetView(cy, o, anim);
    return;
  }

  // Normal tree view: an active filter isolates + re-packs the matches, mirroring
  // focus.
  const criteria = {
    attributes: state.attributes,
    special: state.special,
    personalities: state.personalities,
  };
  if (hasActiveCriteria(criteria)) {
    const matching = filterSlugs(appData().db, criteria);
    compactFilter(cy, matching, o);
    fitEles(cy, matching, 60, anim);
    return;
  }

  const anchor = state.selected ? cy.$id(state.selected) : null;
  if (anchor?.length) {
    centerNode(cy, anchor, 0.6, anim);
  } else {
    resetView(cy, o, anim);
  }
}

/**
 * Re-pack the compact focus view after a branch is hidden or restored, WITHOUT
 * moving the camera. compactFocus re-sequences the remaining members so the gap
 * a hidden branch leaves behind closes up — but on its own that shifts every
 * node, which would slide the lineage out from under a static viewport. So we
 * pin the focus node: record where it sits on screen, re-pack, then pan by the
 * exact delta so it lands back on that same pixel. The kept branches close ranks
 * around it; the viewport itself never pans or zooms.
 *
 * Only the compact (hide-others) view has gaps to close — in dim mode the full
 * graph layout stays put and hidden branches just fade, so there's nothing to
 * re-pack. Focus (re)framing on enter/exit stays with frameGraph; this only runs
 * when exclusions change under a stable focus.
 */
function repackFocusStable(): void {
  const cy = getCy();
  if (!cy) return;
  const { focus, hideOthers, orientation, lineageExcluded } = useStore.getState();
  if (!focus || !hideOthers) return;
  const node = cy.$id(focus);
  if (!node.length) return;
  const before = node.renderedPosition();
  compactFocus(cy, focus, orientation, lineageExcluded);
  const after = node.renderedPosition();
  cy.panBy({ x: before.x - after.x, y: before.y - after.y });
}

export function useGraphController(): void {
  useEffect(() => {
    const unsubscribers = [
      // appearance: any of these slices changes → one full recompute. The active
      // *route* is tracked (not the whole `s.route`) so that hovering a step —
      // which only swaps `route.activeStep` — doesn't drag the full recompute;
      // the dedicated active-step subscription below handles that cheaply.
      useStore.subscribe(
        (s) =>
          [
            s.selected,
            s.focus,
            s.hideOthers,
            s.attributes,
            s.special,
            s.personalities,
            s.routeOpen ? (s.route.routes?.[s.route.active] ?? null) : null,
            s.routeOpen,
            s.lineageExcluded,
            s.discovery,
          ] as const,
        () => {
          recompute(useStore.getState());
          manageRouteFlow(); // (re)bind the flow to the current active-step edge
        },
        { equalityFn: (a, b) => a.every((v, i) => v === b[i]) },
      ),

      // active route step (hover): re-stamp just the `route-step-active` edge and
      // rebind the marching-ants flow — no full appearance recompute.
      useStore.subscribe(
        (s) => s.route.activeStep,
        () => {
          updateActiveStep(useStore.getState());
          manageRouteFlow();
        },
      ),

      // lock-on pulse when a new Digimon is selected (runs after the appearance
      // subscription above has stamped .sel, so the accent underlay is present)
      useStore.subscribe(
        (s) => s.selected,
        (selected) => {
          if (selected) pulseSelection(selected);
          else clearPulse(getCy());
        },
      ),

      // viewport: pan to a new selection (only when not (re)framing for focus)
      useStore.subscribe(
        (s) => s.selected,
        (selected) => {
          const cy = getCy();
          if (!cy || !selected || useStore.getState().focus) return;
          const node = cy.$id(selected);
          if (!node.length) return;
          // Cancel any in-flight viewport animation first: cy.animate() queues by
          // default, so without this a quick second pick would tour through the
          // previous target(s) instead of heading straight to the newest one.
          cy.stop();
          // Always recentre the node; zoom in only if we're currently too far out
          // to read it. Deriving the pan from the node's model position (rather
          // than `center: { eles }` / `zoom: { position }`) means the target is
          // immune to the selection pulse's animating underlay, AND the zoom-in
          // case actually recentres instead of zooming in place (the old bug).
          const z = cy.zoom() < 0.4 ? 0.8 : cy.zoom();
          const p = node.position();
          const pan = { x: cy.width() / 2 - p.x * z, y: cy.height() / 2 - p.y * z };
          if (prefersReduce()) {
            cy.zoom(z);
            cy.pan(pan);
          } else {
            cy.animate({ zoom: z, pan, duration: 300, easing: 'ease-out-cubic' });
          }
        },
      ),

      // layout + viewport: recompute positions and framing together. Filter
      // criteria are here too — in the normal view they isolate + re-pack.
      //
      // `lineageExcluded` is deliberately NOT here: hiding / restoring a branch
      // should only toggle its visibility (handled by the appearance subscription
      // above), never re-fit the camera or re-pack the lineage. Keeping it out
      // means the branches you're keeping stay exactly where they were — no jump
      // to chase — and a restored branch slots straight back into place. A genuine
      // re-layout (orientation, hide/dim mode) still honours the current
      // exclusions, since frameGraph reads them live.
      useStore.subscribe(
        (s) =>
          [
            s.focus,
            s.hideOthers,
            s.orientation,
            s.attributes,
            s.special,
            s.personalities,
            s.routeOpen ? (s.route.routes?.[s.route.active] ?? null) : null,
          ] as const,
        () => {
          const cy = getCy();
          if (cy) frameGraph(cy);
        },
        { equalityFn: (a, b) => a.every((v, i) => v === b[i]) },
      ),

      // Re-pack (but don't re-frame) when a branch is hidden / restored under a
      // stable focus, so gaps close without the camera chasing them. A focus
      // change resets exclusions and is (re)framed by the layout subscription
      // above, so skip it here to avoid fighting that fit.
      useStore.subscribe(
        (s) => ({ focus: s.focus, excluded: s.lineageExcluded }),
        (cur, prev) => {
          if (cur.focus !== prev.focus || cur.excluded === prev.excluded) return;
          repackFocusStable();
        },
        { equalityFn: (a, b) => a.focus === b.focus && a.excluded === b.excluded },
      ),
    ];
    recompute(useStore.getState());
    manageRouteFlow();
    // A deep-linked focus / route / selection is set before we subscribe — frame it
    // once on mount. Selection is included so a cold #/d/<slug> link (or a refresh)
    // centres the node instead of parking the graph at the overview with the node
    // stranded in a corner; the pan-to-selection subscription only fires on later
    // changes, never the initial value.
    const cy = getCy();
    const s0 = useStore.getState();
    if (cy && (s0.focus || s0.routeOpen || s0.selected)) frameGraph(cy, false);
    return () => {
      unsubscribers.forEach((u) => u());
      if (flowRAF) {
        cancelAnimationFrame(flowRAF);
        flowRAF = 0;
      }
      lastPulsed = null;
    };
  }, []);
}
