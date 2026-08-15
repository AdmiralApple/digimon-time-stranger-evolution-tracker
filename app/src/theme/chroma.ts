// The chromatic-identity bridge: each Digimon's sprite yields a signature OKLCH
// hue+chroma (precomputed in src/generated/colors.json by scripts/sync-data.mjs).
// CSS consumes hue/chroma via custom properties and builds the accent ramp with
// oklch(); the Cytoscape canvas needs a concrete sRGB colour, so we convert.
import colorsJson from '../generated/colors.json';

export interface AccentSeed {
  h: number; // OKLCH hue, degrees
  c: number; // OKLCH chroma (sprite's own, muted)
}

const COLORS = colorsJson as Record<string, AccentSeed>;

/** Default brand accent when nothing is selected — a warm temporal amber. */
export const DEFAULT_ACCENT: AccentSeed = { h: 72, c: 0.12 };

// Sprite chroma is conservative; give UI accents a consistent, usable punch
// without letting a neon sprite blow out the neutral chrome.
const uiChroma = (c: number): number => Math.min(0.17, Math.max(0.1, c * 1.35));

export function accentFor(slug: string | null | undefined): AccentSeed {
  if (!slug) return DEFAULT_ACCENT;
  return COLORS[slug] ?? DEFAULT_ACCENT;
}

// --- OKLCH → sRGB hex (inverse of the extraction math; for canvas colours) ---
function linearToSrgb(c: number): number {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, v)) * 255);
}

export function oklchToHex(L: number, C: number, H: number): string {
  const hr = (H * Math.PI) / 180;
  const a = Math.cos(hr) * C;
  const b = Math.sin(hr) * C;
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  const r = linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const g = linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const bl = linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
  return '#' + [r, g, bl].map((n) => n.toString(16).padStart(2, '0')).join('');
}

/** Concrete sRGB accent for a graph node glow (theme-independent mid lightness). */
export function nodeAccentHex(slug: string): string {
  const { h, c } = accentFor(slug);
  return oklchToHex(0.72, uiChroma(c), h);
}

/**
 * Point the app's chromatic accent at a Digimon (or reset to the brand amber).
 * Sets only hue+chroma; the active theme owns lightness, so the same accent
 * reads correctly in light and dark.
 */
export function applyAccent(slug: string | null): void {
  const { h, c } = accentFor(slug);
  const root = document.documentElement.style;
  root.setProperty('--accent-h', String(h));
  root.setProperty('--accent-c', String(uiChroma(c)));
}
