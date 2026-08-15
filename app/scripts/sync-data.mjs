// data/ (scraper drop-in, committed) → public/ (gitignored, served by Vite).
// Copies digimon.json + full icons, packs every 128px sprite into ONE webp
// atlas for graph nodes + list thumbnails, and extracts each sprite's signature
// colour (OKLCH hue+chroma) into src/generated/colors.json — the seed for the
// app's chromatic identity.
// Incremental: skips outputs newer than their source, so the predev hook is a
// fast no-op when nothing changed.
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..');
const DATA = path.join(ROOT, 'data');
const PUBLIC = path.join(ROOT, 'public');
const COLORS_OUT = path.join(ROOT, 'src', 'generated', 'colors.json');
const ATLAS_IMG = path.join(PUBLIC, 'atlas', 'thumbs.webp');
const ATLAS_OUT = path.join(ROOT, 'src', 'generated', 'atlas.json');

const TILE = 128; // per-sprite tile; 56px nodes @2x DPR need >=112px
const THUMB_QUALITY = 75;

// Accent chroma is floored so even muted/metallic sprites yield a usable UI
// accent, and capped so neon sprites don't overwhelm the neutral chrome.
const ACCENT_C_MIN = 0.06;
const ACCENT_C_MAX = 0.19;

async function mtime(file) {
  try {
    return (await stat(file)).mtimeMs;
  } catch {
    return -1;
  }
}

// --- sRGB → OKLCH (inlined; no runtime dependency) ---------------------------
function srgbToLinear(c) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function rgbToOklch(r, g, b) {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const C = Math.hypot(a, bb);
  let H = (Math.atan2(bb, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L, C, H };
}

/**
 * A sprite's signature colour: the dominant *vibrant* hue.
 * Bins opaque, mid-lightness, chromatic pixels into 24 hue buckets weighted by
 * chroma, picks the heaviest bucket, and returns the chroma-weighted mean hue
 * and chroma of that bucket. Grayscale sprites fall back to a neutral accent.
 */
async function extractAccent(src) {
  // These icons carry a deliberate chromatic-aberration (RGB-split) glitch —
  // a "time distortion" motif — that fringes edges with vivid green/magenta.
  // A pre-blur merges the split channels back so the fringe stops hijacking the
  // dominant hue; the strict alpha gate below drops the remaining soft edges.
  const { data, info } = await sharp(src)
    .blur(3)
    .resize(48, 48, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels; // 4 (RGBA)
  const BINS = 24;
  const binWeight = new Float64Array(BINS);
  const binHueX = new Float64Array(BINS); // circular-mean accumulators
  const binHueY = new Float64Array(BINS);
  const binChroma = new Float64Array(BINS);

  for (let i = 0; i < data.length; i += channels) {
    const alpha = channels === 4 ? data[i + 3] : 255;
    if (alpha < 160) continue; // strict: drop soft/fringed edges
    const { L, C, H } = rgbToOklch(data[i], data[i + 1], data[i + 2]);
    if (L < 0.2 || L > 0.9 || C < 0.05) continue; // skip outline / highlight / near-gray
    // Area-weighted: the signature colour is the dominant *region*, not a small
    // vivid highlight. (Chroma-weighting biased every sprite toward its most
    // saturated speck.)
    const weight = alpha / 255;
    const bin = Math.min(BINS - 1, Math.floor((H / 360) * BINS));
    const rad = (H * Math.PI) / 180;
    binWeight[bin] += weight;
    binHueX[bin] += Math.cos(rad) * weight;
    binHueY[bin] += Math.sin(rad) * weight;
    binChroma[bin] += C * weight;
  }

  let best = -1;
  let bestWeight = 0;
  for (let b = 0; b < BINS; b++) {
    if (binWeight[b] > bestWeight) {
      bestWeight = binWeight[b];
      best = b;
    }
  }

  if (best < 0 || bestWeight === 0) {
    return { h: 70, c: ACCENT_C_MIN }; // grayscale sprite → neutral warm accent
  }

  let hue = (Math.atan2(binHueY[best], binHueX[best]) * 180) / Math.PI;
  if (hue < 0) hue += 360;
  const chroma = binChroma[best] / binWeight[best];
  return {
    h: Math.round(hue * 10) / 10,
    c: Math.round(Math.min(ACCENT_C_MAX, Math.max(ACCENT_C_MIN, chroma)) * 1000) / 1000,
  };
}

async function main() {
  await mkdir(path.join(PUBLIC, 'icons'), { recursive: true });
  await mkdir(path.join(PUBLIC, 'atlas'), { recursive: true });

  let copied = 0;

  const jsonSrc = path.join(DATA, 'digimon.json');
  const jsonDest = path.join(PUBLIC, 'digimon.json');
  if ((await mtime(jsonSrc)) > (await mtime(jsonDest))) {
    await copyFile(jsonSrc, jsonDest);
    copied += 1;
  }

  const icons = (await readdir(path.join(DATA, 'icons'))).filter((f) => f.endsWith('.png'));

  let newestIcon = -1;
  for (const file of icons) {
    const src = path.join(DATA, 'icons', file);
    const srcTime = await mtime(src);
    if (srcTime > newestIcon) newestIcon = srcTime;

    const iconDest = path.join(PUBLIC, 'icons', file);
    if (srcTime > (await mtime(iconDest))) {
      await copyFile(src, iconDest);
      copied += 1;
    }
  }

  // Sprite atlas — pack every 128px sprite into ONE webp so a fresh visit costs
  // a single image request instead of ~475 (Vercel bills per request). Rebuilt
  // whenever any sprite is newer than the sheet. The manifest (slug order + grid
  // dims) is emitted to src/generated so the app maps a slug → its tile with no
  // runtime request; the src carries a content-hash query so the sheet can be
  // cached immutably yet still bust when the roster or art changes.
  let atlased = 0;
  if (newestIcon > (await mtime(ATLAS_IMG))) {
    const slugs = icons.map((f) => f.replace(/\.png$/, '')).sort();
    const cols = Math.ceil(Math.sqrt(slugs.length));
    const rows = Math.ceil(slugs.length / cols);
    const tiles = await Promise.all(
      slugs.map(async (slug, i) => ({
        input: await sharp(path.join(DATA, 'icons', `${slug}.png`))
          .resize(TILE, TILE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer(),
        left: (i % cols) * TILE,
        top: Math.floor(i / cols) * TILE,
      })),
    );
    const sheet = await sharp({
      create: {
        width: cols * TILE,
        height: rows * TILE,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite(tiles)
      .webp({ quality: THUMB_QUALITY })
      .toBuffer();
    await writeFile(ATLAS_IMG, sheet);
    const v = createHash('sha256').update(sheet).digest('hex').slice(0, 8);
    const manifest = { version: 1, src: `/atlas/thumbs.webp?v=${v}`, tile: TILE, cols, rows, count: slugs.length, slugs };
    await writeFile(ATLAS_OUT, JSON.stringify(manifest) + '\n');
    atlased = slugs.length;
  }

  // Chromatic accents — regenerate the whole map when any sprite is newer than
  // the committed colors.json (cheap: 475 tiny raw decodes, only on a re-scrape).
  let colored = 0;
  if (newestIcon > (await mtime(COLORS_OUT))) {
    const colors = {};
    for (const file of icons) {
      const slug = file.replace(/\.png$/, '');
      colors[slug] = await extractAccent(path.join(DATA, 'icons', file));
    }
    const sorted = Object.fromEntries(Object.keys(colors).sort().map((k) => [k, colors[k]]));
    await writeFile(COLORS_OUT, JSON.stringify(sorted, null, 0) + '\n');
    colored = icons.length;
  }

  console.log(
    `data:sync — ${icons.length} icons; ${copied} copied, ` +
      `${atlased ? atlased + ' atlased' : 'atlas cached'}, ` +
      `${colored ? colored + ' accents' : 'accents cached'}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
