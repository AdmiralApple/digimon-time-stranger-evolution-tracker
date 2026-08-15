// Build-time layout: ELK layered with generation partitions for the main
// ladder (In-Training I → Mega +, Armor folded into the Champion band), plus a
// hand-laid lane for the self-contained Hybrid cluster. Emits committed
// src/generated/layout.json consumed as `layout: { name: 'preset' }`.
//
// Deterministic: nodes/edges pre-sorted by dex number, considerModelOrder on,
// no timestamps beyond the data's own scrapedAt. Re-run after a re-scrape.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ELK from 'elkjs';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..');

const NODE_W = 76;
const NODE_H = 92;
const COLUMN_PITCH = 460;  // horizontal distance between generation columns
const NODE_PITCH = 104;    // vertical pitch inside a column
const LANE_GAP = 260;      // gap between main graph and hybrid lane

const PARTITIONS = {
  'In-Training I': 0,
  'In-Training II': 1,
  'Rookie': 2,
  'Champion': 3,
  'Armor': 3, // Champion-tier side rank (9/10 in-edges from Rookie, item-gated)
  'Ultimate': 4,
  'Mega': 5,
  'Mega +': 6,
};

async function main() {
  const db = JSON.parse(await readFile(path.join(ROOT, 'data', 'digimon.json'), 'utf-8'));
  const all = Object.values(db.digimon).sort((a, b) => a.number - b.number);
  const hybrids = all.filter((d) => d.generation === 'Hybrid');
  const ladder = all.filter((d) => d.generation !== 'Hybrid');
  const ladderSlugs = new Set(ladder.map((d) => d.slug));

  // --- Main ladder through ELK ---
  const children = ladder.map((d) => ({
    id: d.slug,
    width: NODE_W,
    height: NODE_H,
    layoutOptions: { 'org.eclipse.elk.partitioning.partition': String(PARTITIONS[d.generation]) },
  }));
  const edges = [];
  for (const d of ladder) {
    for (const to of d.evolvesTo) {
      if (ladderSlugs.has(to)) {
        edges.push({ id: `${d.slug}->${to}`, sources: [d.slug], targets: [to] });
      }
    }
  }

  const elk = new ELK();
  const result = await elk.layout({
    id: 'root',
    layoutOptions: {
      'org.eclipse.elk.algorithm': 'layered',
      'org.eclipse.elk.direction': 'RIGHT',
      'org.eclipse.elk.partitioning.activate': 'true',
      'org.eclipse.elk.layered.cycleBreaking.strategy': 'GREEDY',
      'org.eclipse.elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'org.eclipse.elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'org.eclipse.elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'org.eclipse.elk.layered.spacing.nodeNodeBetweenLayers': '260',
      'org.eclipse.elk.spacing.nodeNode': '28',
    },
    children,
    edges,
  });

  // Snap to uniform columns: keep ELK's crossing-minimized vertical ORDER,
  // discard its raw coordinates. x = partition center; y = order * pitch.
  const elkPos = new Map(result.children.map((c) => [c.id, { x: c.x, y: c.y }]));
  const positions = {};
  const byPartition = new Map();
  for (const d of ladder) {
    const p = PARTITIONS[d.generation];
    if (!byPartition.has(p)) byPartition.set(p, []);
    byPartition.get(p).push(d.slug);
  }
  for (const [p, slugs] of byPartition) {
    slugs.sort((a, b) => elkPos.get(a).y - elkPos.get(b).y || a.localeCompare(b));
    slugs.forEach((slug, i) => {
      positions[slug] = { x: p * COLUMN_PITCH, y: Math.round(i * NODE_PITCH) };
    });
  }

  // --- Hybrid lane: connected components (internal edges), columns by BFS depth ---
  const hybridSlugs = new Set(hybrids.map((d) => d.slug));
  const internalOut = new Map(
    hybrids.map((d) => [d.slug, d.evolvesTo.filter((t) => hybridSlugs.has(t))]),
  );
  const undirected = new Map(hybrids.map((d) => [d.slug, new Set()]));
  for (const [from, tos] of internalOut) {
    for (const to of tos) {
      undirected.get(from).add(to);
      undirected.get(to).add(from);
    }
  }
  const componentOf = new Map();
  let componentCount = 0;
  for (const d of hybrids) {
    if (componentOf.has(d.slug)) continue;
    const queue = [d.slug];
    componentOf.set(d.slug, componentCount);
    while (queue.length) {
      for (const n of undirected.get(queue.shift())) {
        if (!componentOf.has(n)) {
          componentOf.set(n, componentCount);
          queue.push(n);
        }
      }
    }
    componentCount += 1;
  }

  // depth = fusion level (Spirit forms = 0, deeper fusions increase), laid out in
  // columns. The Spirit graph has mode-change 2-cycles (Human <-> Beast spirit,
  // etc.); a naive longest-path relaxation runs away on those, so strip the
  // reciprocal edges to a DAG, longest-path on that, then snap each mode-change
  // pair to their shared max depth so partners sit in the same column.
  const isModeChange = (from, to) => (internalOut.get(to) ?? []).includes(from);
  const dagOut = new Map(
    hybrids.map((d) => [
      d.slug,
      (internalOut.get(d.slug) ?? []).filter((to) => !isModeChange(d.slug, to)),
    ]),
  );
  const depth = new Map(hybrids.map((d) => [d.slug, 0]));
  for (let pass = 0; pass < hybrids.length; pass++) {
    let changed = false;
    for (const [from, tos] of dagOut) {
      for (const to of tos) {
        if (depth.get(from) + 1 > depth.get(to)) {
          depth.set(to, depth.get(from) + 1);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  for (const [from, tos] of internalOut) {
    for (const to of tos) {
      if (isModeChange(from, to)) {
        const shared = Math.max(depth.get(from), depth.get(to));
        depth.set(from, shared);
        depth.set(to, shared);
      }
    }
  }

  // Hybrid is a self-contained Spirit-evolution cluster with no edges to the main
  // ladder. Lay it out AFTER Mega + along the generation axis (a clear gap past the
  // last column) and top-aligned along the digimon axis, so it reads as "the section
  // after Mega +" in either orientation — to the right in columns, below in rows —
  // instead of floating mid-graph.
  const maxPartition = Math.max(...Object.values(PARTITIONS));
  const laneStartX = (maxPartition + 1) * COLUMN_PITCH + LANE_GAP;
  const laneTopY = 0;
  const laneRowPitch = NODE_PITCH;
  const byComponent = new Map();
  for (const d of hybrids) {
    const c = componentOf.get(d.slug);
    if (!byComponent.has(c)) byComponent.set(c, []);
    byComponent.get(c).push(d);
  }
  // components stack sequentially so families can never collide
  let baseY = laneTopY;
  for (const [, members] of [...byComponent.entries()].sort((a, b) => a[0] - b[0])) {
    const stacks = new Map(); // depth → occupied rows in this family
    let maxStack = 0;
    for (const d of members.sort((a, b) => a.number - b.number)) {
      const dep = Math.min(depth.get(d.slug), 3);
      const s = stacks.get(dep) ?? 0;
      stacks.set(dep, s + 1);
      maxStack = Math.max(maxStack, s + 1);
      positions[d.slug] = {
        x: laneStartX + dep * COLUMN_PITCH,
        y: Math.round(baseY + s * laneRowPitch),
      };
    }
    baseY += (maxStack + 1) * laneRowPitch;
  }

  const xs = Object.values(positions).map((p) => p.x);
  const ys = Object.values(positions).map((p) => p.y);
  const bounds = {
    minX: Math.min(...xs), maxX: Math.max(...xs),
    minY: Math.min(...ys), maxY: Math.max(...ys),
  };
  const columns = [...new Set(Object.values(PARTITIONS))].sort((a, b) => a - b).map((p) => ({
    x: p * COLUMN_PITCH,
    generations: Object.entries(PARTITIONS).filter(([, v]) => v === p).map(([k]) => k),
    count: byPartition.get(p)?.length ?? 0,
  }));

  const out = {
    meta: { dataScrapedAt: db.meta.scrapedAt, nodeCount: all.length, edgeCount: edges.length },
    bounds,
    columns,
    hybridLane: { y: laneTopY, x: laneStartX, label: 'Hybrid (Spirit)' },
    positions,
  };
  await mkdir(path.join(ROOT, 'src', 'generated'), { recursive: true });
  await writeFile(
    path.join(ROOT, 'src', 'generated', 'layout.json'),
    JSON.stringify(out, null, 1) + '\n',
    'utf-8',
  );
  console.log(
    `layout — ${all.length} nodes (${hybrids.length} in hybrid lane), bounds ${bounds.maxX - bounds.minX}x${bounds.maxY - bounds.minY}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
