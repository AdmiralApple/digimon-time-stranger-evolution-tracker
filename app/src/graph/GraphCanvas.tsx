import cytoscape from 'cytoscape';
import { useEffect, useRef } from 'react';
import { appData } from '../data/appData';
import { edgeKey } from '../data/graph';
import { hasActiveCriteria } from '../data/search';
import { revealedSet, useStore } from '../state/store';
import { attachBandLayer } from './bandLayer';
import { registerCy, unregisterCy } from './cyInstance';
import { buildElements } from './elements';
import { buildStylesheet } from './stylesheet';
import { arrangeGraph, resetView } from './viewport';
import { useGraphController } from './controllers/useGraphController';
import { GRAPH_PALETTES } from '../theme/attribute';
import { getTheme, subscribeTheme } from '../theme/theme';
import { revealedFrontierConnections } from './frontier';

export function GraphCanvas() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const orientation = useStore.getState().orientation;
    const cy = cytoscape({
      container: ref.current!,
      elements: buildElements(appData(), orientation),
      style: buildStylesheet(GRAPH_PALETTES[getTheme()]) as never,
      layout: { name: 'preset' },
      autoungrabify: true,
      autounselectify: true, // selection lives in the store, styled via .sel
      boxSelectionEnabled: false,
      minZoom: 0.03,
      maxZoom: 3,
      // A deliberate step above Cytoscape's default so a mouse-wheel notch has
      // enough authority to move through this unusually large atlas quickly.
      wheelSensitivity: 5.4,
      // Keep the graph live during viewport gestures. `textureOnViewport` caches
      // only the currently painted canvas; translating that snapshot exposes a
      // blank strip at the leading edge until the gesture ends and Cytoscape
      // repaints. The sprite atlas keeps direct rendering affordable here.
      hideEdgesOnViewport: false,
      textureOnViewport: false,
      motionBlur: false,
      pixelRatio: 'auto',
    } as cytoscape.CytoscapeOptions);

    // initial viewport: a readable slab at the In-Training end rather than a
    // fit-all sliver (orientation-aware — the long axis flips with it)
    resetView(cy, orientation);
    registerCy(cy);

    // Alternating generation-stage shading behind the graph (full-graph view only).
    const detachBandLayer = attachBandLayer(cy);

    // Repaint the viewport when the chrome theme flips. Element classes persist
    // across a stylesheet swap, so the appearance layers (selection, lineage,
    // route, dim) re-map to the new palette automatically — no recompute needed.
    const unsubscribeTheme = subscribeTheme((theme) => {
      cy.style(buildStylesheet(GRAPH_PALETTES[theme]) as never);
    });

    // Keep the renderer in sync with container-size changes the window 'resize'
    // event doesn't cover: device rotation, the desktop↔overlay breakpoint (the
    // side panel docking / undocking), and the filter bar opening. Coalesced to
    // one resize per frame.
    let resizePending = 0;
    const resizeObserver = new ResizeObserver(() => {
      if (resizePending) return;
      resizePending = requestAnimationFrame(() => {
        resizePending = 0;
        cy.resize();
      });
    });
    resizeObserver.observe(ref.current!);

    // The full graph has 1,120 links. A segment whose other endpoint is far past
    // the camera explains nothing and creates the impression of a hairball, so
    // the overview keeps only links whose endpoints are both near the viewport.
    // Highlight rules override this class, meaning a hovered/selected direct link
    // can still point toward an off-screen destination.
    let edgeCullPending = 0;
    const cullEdgesToViewport = () => {
      edgeCullPending = 0;
      const extent = cy.extent();
      const margin = 160 / Math.max(cy.zoom(), 0.001);
      const visible = new Set<string>();
      cy.nodes().forEach((node) => {
        if (node.hasClass('col-label') || node.hasClass('hidden')) return;
        const { x, y } = node.position();
        if (
          x >= extent.x1 - margin &&
          x <= extent.x2 + margin &&
          y >= extent.y1 - margin &&
          y <= extent.y2 + margin
        ) {
          visible.add(node.id());
        }
      });
      cy.batch(() => {
        cy.edges().forEach((edge) => {
          const offscreen = !visible.has(edge.source().id()) || !visible.has(edge.target().id());
          if (offscreen === edge.hasClass('edge-offscreen')) return;
          edge[offscreen ? 'addClass' : 'removeClass']('edge-offscreen');
        });
      });
    };
    const scheduleEdgeCull = () => {
      if (edgeCullPending) return;
      edgeCullPending = requestAnimationFrame(cullEdgesToViewport);
    };
    cy.on('pan zoom resize layoutstop', scheduleEdgeCull);
    scheduleEdgeCull();

    const container = ref.current!;
    let hoveredId = '';
    let frontierId = '';
    const clearFrontierPreview = () => {
      if (!frontierId) return;
      cy.$id(frontierId).removeClass('frontier-active');
      cy.nodes('.frontier-neighbor').removeClass('frontier-neighbor');
      cy.edges('.frontier-next, .frontier-prev').removeClass('frontier-next frontier-prev');
      frontierId = '';
    };
    const clearHoverPreview = () => {
      if (!hoveredId) return;
      const graph = appData().graph;
      cy.$id(hoveredId).removeClass('hover');
      for (const from of graph.inn.get(hoveredId) ?? []) {
        cy.$id(edgeKey(from, hoveredId)).removeClass('hover-prev');
        cy.$id(from).removeClass('hover-neighbor');
      }
      for (const to of graph.out.get(hoveredId) ?? []) {
        cy.$id(edgeKey(hoveredId, to)).removeClass('hover-next');
        cy.$id(to).removeClass('hover-neighbor');
      }
      hoveredId = '';
      container.style.cursor = '';
    };

    let lastTap = { id: '', time: 0 };
    cy.on('tap', 'node', (event) => {
      const node = event.target;
      // A frontier silhouette never opens the detail panel (which would reveal
      // its identity). Instead, persistently trace every revealed form that put
      // it on the one-hop frontier. Direction colours match normal selection.
      if (node.hasClass('fog')) {
        clearHoverPreview();
        clearFrontierPreview();
        // Hand off from the normal selection layer before stamping the manual
        // silhouette preview. Otherwise the previous node's neighborhood stays
        // highlighted because silhouettes intentionally never become `selected`.
        // This update is synchronous; its appearance recompute finishes before
        // the frontier classes below are applied.
        useStore.getState().select(null);
        const id = node.id() as string;
        const revealed = revealedSet(useStore.getState().discovery);
        const connections = revealedFrontierConnections(appData().graph, revealed, id);
        if (!connections.length) return;
        frontierId = id;
        node.addClass('frontier-active');
        for (const [from, to] of connections) {
          const neighbor = from === id ? to : from;
          cy.$id(neighbor).addClass('frontier-neighbor');
          cy.$id(edgeKey(from, to)).addClass(from === id ? 'frontier-next' : 'frontier-prev');
        }

        // Silhouettes intentionally never enter the normal selected state (that
        // would feed their identity to the detail panel), so invoke the same
        // relationship-aware lerp explicitly. `arrangeGraph` reads the clicked
        // silhouette's current visual slot, preserving smooth path-following
        // when it was moved by the previous click.
        const state = useStore.getState();
        const criteria = {
          attributes: state.attributes,
          special: state.special,
          personalities: state.personalities,
        };
        if (
          state.graphOrder === 'connections' &&
          !state.focus &&
          !state.routeOpen &&
          !hasActiveCriteria(criteria)
        ) {
          arrangeGraph(cy, state.graphOrder, id, state.orientation, true);
        }
        return;
      }
      // Fully hidden nodes and generation watermark labels aren't selectable.
      if (node.hasClass('hidden') || node.hasClass('col-label')) return;
      const id = node.id() as string;
      const now = Date.now();
      clearHoverPreview();
      clearFrontierPreview();
      // manual double-tap detection (cy's dbltap needs selection events)
      if (lastTap.id === id && now - lastTap.time < 350) {
        useStore.getState().setFocus(id);
      } else {
        useStore.getState().select(id);
      }
      lastTap = { id, time: now };
    });
    cy.on('tap', (event) => {
      if (event.target === cy) {
        clearHoverPreview();
        clearFrontierPreview();
        useStore.getState().select(null);
      }
    });

    // Hover previews only the immediate incoming/outgoing relationships. This is
    // the lightweight way to inspect the atlas; a click persists the same local
    // view for touch users, while focus mode expands to the exhaustive lineage.
    cy.on('mouseover', 'node', (event) => {
      const node = event.target;
      if (node.hasClass('col-label')) return;
      clearHoverPreview();
      // Fog silhouettes are clickable connection hints, but still get no
      // signature-hue sheen (that would leak their identity).
      if (node.hasClass('fog')) {
        container.style.cursor = 'pointer';
        return;
      }
      if (node.hasClass('hidden')) {
        container.style.cursor = 'default';
        return;
      }
      const id = node.id() as string;
      const graph = appData().graph;
      hoveredId = id;
      node.addClass('hover');
      for (const from of graph.inn.get(id) ?? []) {
        cy.$id(edgeKey(from, id)).addClass('hover-prev');
        cy.$id(from).addClass('hover-neighbor');
      }
      for (const to of graph.out.get(id) ?? []) {
        cy.$id(edgeKey(id, to)).addClass('hover-next');
        cy.$id(to).addClass('hover-neighbor');
      }
      container.style.cursor = 'pointer';
    });
    cy.on('mouseout', 'node', (event) => {
      if (event.target.id() === hoveredId) clearHoverPreview();
    });

    return () => {
      detachBandLayer();
      unsubscribeTheme();
      resizeObserver.disconnect();
      if (resizePending) cancelAnimationFrame(resizePending);
      cy.off('pan zoom resize layoutstop', scheduleEdgeCull);
      if (edgeCullPending) cancelAnimationFrame(edgeCullPending);
      clearHoverPreview();
      clearFrontierPreview();
      unregisterCy();
      cy.destroy();
    };
  }, []);

  useGraphController();

  // The graph is a pointer-driven <canvas>: its nodes aren't in the DOM or the
  // a11y tree. Label the region and point assistive-tech / keyboard users at the
  // paths that ARE accessible (search and the Field guide table).
  return (
    <div
      ref={ref}
      role="img"
      aria-label="Evolution graph — a visual network of all 475 Digimon. This view is pointer-driven; use the search field (press /) or the Field guide table to find and open a Digimon."
      style={{ width: '100%', height: '100%' }}
    />
  );
}
