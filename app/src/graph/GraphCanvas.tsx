import cytoscape from 'cytoscape';
import { useEffect, useRef } from 'react';
import { appData } from '../data/appData';
import { useStore } from '../state/store';
import { attachBandLayer } from './bandLayer';
import { registerCy, unregisterCy } from './cyInstance';
import { buildElements } from './elements';
import { buildStylesheet } from './stylesheet';
import { resetView } from './viewport';
import { useGraphController } from './controllers/useGraphController';
import { GRAPH_PALETTES } from '../theme/attribute';
import { getTheme, subscribeTheme } from '../theme/theme';

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
      // renderer perf options. The 475 nodes each re-sample a large shared sprite
      // sheet every frame, which makes live zoom/pan expensive; caching the scene
      // to a texture during viewport gestures keeps it smooth (edges included, so
      // the lineage links never vanish mid-gesture) and re-renders crisp on settle.
      hideEdgesOnViewport: false,
      textureOnViewport: true,
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

    let lastTap = { id: '', time: 0 };
    cy.on('tap', 'node', (event) => {
      const node = event.target;
      // Spoiler-free: undiscovered nodes (fog silhouettes / hidden) never open the
      // detail panel — that would reveal exactly what the fog is meant to conceal.
      // Generation watermark labels aren't selectable Digimon either.
      if (node.hasClass('fog') || node.hasClass('hidden') || node.hasClass('col-label')) return;
      const id = node.id() as string;
      const now = Date.now();
      // manual double-tap detection (cy's dbltap needs selection events)
      if (lastTap.id === id && now - lastTap.time < 350) {
        useStore.getState().setFocus(id);
      } else {
        useStore.getState().select(id);
      }
      lastTap = { id, time: now };
    });
    cy.on('tap', (event) => {
      if (event.target === cy) useStore.getState().select(null);
    });

    // Hover: a signature-hue sheen + pointer cursor on real Digimon nodes (not
    // the generation watermark labels). One node at a time — negligible cost.
    const container = ref.current!;
    cy.on('mouseover', 'node', (event) => {
      const node = event.target;
      if (node.hasClass('col-label')) return;
      // Fog silhouettes stay inert: no signature-hue sheen (a colour spoiler) and
      // no pointer cursor, since clicking them does nothing.
      if (node.hasClass('fog') || node.hasClass('hidden')) {
        container.style.cursor = 'default';
        return;
      }
      node.addClass('hover');
      container.style.cursor = 'pointer';
    });
    cy.on('mouseout', 'node', (event) => {
      event.target.removeClass('hover');
      container.style.cursor = '';
    });

    return () => {
      detachBandLayer();
      unsubscribeTheme();
      resizeObserver.disconnect();
      if (resizePending) cancelAnimationFrame(resizePending);
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
