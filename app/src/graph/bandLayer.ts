import type { Core } from 'cytoscape';
import { appData } from '../data/appData';
import { useStore } from '../state/store';
import { GRAPH_PALETTES } from '../theme/attribute';
import { getTheme, subscribeTheme } from '../theme/theme';
import { computeBands } from './bands';
import { genAxis } from './orient';

const GRID_PITCH = 32;
const GRID_MIN_SCREEN_PITCH = 16;

/**
 * Graph-space background grid + stage shading. Cytoscape has no gridline /
 * background-layer concept, so both are painted onto our own <canvas>, inserted
 * behind cytoscape's canvases and kept in sync with the viewport on 'render'.
 * Model → screen is `coord * zoom + pan`, which makes the grid move and scale
 * with the nodes instead of sticking to the application chrome while panning.
 *
 * Only the full-graph view is banded: in focus / route the stages are
 * re-indexed into a compact frame and everything else is hidden, so fixed
 * stage shading would be meaningless there. The canvas is pointer-transparent,
 * so even if the z-order ever failed the faint wash could never swallow a tap.
 */
export function attachBandLayer(cy: Core): () => void {
  const container = cy.container();
  if (!container) return () => {};

  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
  });
  // Sit behind cytoscape's own canvases but ABOVE the container's opaque
  // backdrop: cytoscape wraps its layers in a z-index:0 div, so this canvas
  // goes in as the first child at z-index 0 — later siblings (that wrapper)
  // paint on top, while a negative z-index would drop it behind the graph's
  // background and vanish.
  canvas.style.zIndex = '0';
  container.insertBefore(canvas, container.firstChild);

  const ctx = canvas.getContext('2d')!;
  const bands = computeBands(appData().layout);
  let palette = GRAPH_PALETTES[getTheme()];
  let cssW = 0;
  let cssH = 0;

  const draw = (): void => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const s = useStore.getState();
    const zoom = cy.zoom();
    const pan = cy.pan();

    // Keep lines readable when zoomed far out by dropping alternate subdivisions.
    // The pitch only changes by powers of two, so every visible line stays locked
    // to the same model-space origin and never swims relative to a node.
    let gridPitch = GRID_PITCH;
    while (gridPitch * zoom < GRID_MIN_SCREEN_PITCH) gridPitch *= 2;
    const screenPitch = gridPitch * zoom;
    const firstX = ((pan.x % screenPitch) + screenPitch) % screenPitch;
    const firstY = ((pan.y % screenPitch) + screenPitch) % screenPitch;
    ctx.strokeStyle = palette.border;
    ctx.globalAlpha = 0.13;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = firstX; x <= cssW; x += screenPitch) {
      const crispX = Math.round(x) + 0.5;
      ctx.moveTo(crispX, 0);
      ctx.lineTo(crispX, cssH);
    }
    for (let y = firstY; y <= cssH; y += screenPitch) {
      const crispY = Math.round(y) + 0.5;
      ctx.moveTo(0, crispY);
      ctx.lineTo(cssW, crispY);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    if (s.focus || s.routeOpen) return; // stage bands are full-graph only

    const axis = genAxis(s.orientation);
    ctx.fillStyle = palette.band;
    ctx.globalAlpha = palette.bandOpacity;
    for (const b of bands) {
      if (!b.tint) continue;
      const lo = b.lo * zoom + pan[axis];
      const span = (b.hi - b.lo) * zoom;
      if (axis === 'y') ctx.fillRect(0, lo, cssW, span);
      else ctx.fillRect(lo, 0, span, cssH);
    }
    ctx.globalAlpha = 1;
  };

  const resize = (): void => {
    const dpr = window.devicePixelRatio || 1;
    cssW = container.clientWidth;
    cssH = container.clientHeight;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    draw();
  };

  cy.on('render', draw);
  cy.on('resize', resize);
  const unsubTheme = subscribeTheme((t) => {
    palette = GRAPH_PALETTES[t];
    draw();
  });
  const unsubStore = useStore.subscribe(
    (st) => [st.focus, st.routeOpen, st.orientation] as const,
    draw,
    { equalityFn: (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2] },
  );
  resize();

  return () => {
    cy.off('render', draw);
    cy.off('resize', resize);
    unsubTheme();
    unsubStore();
    canvas.remove();
  };
}
