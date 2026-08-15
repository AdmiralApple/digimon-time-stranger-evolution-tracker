import type { EvolutionGraph } from './graph';
import type { AgentSkillRequirement, JogressPartner, StatKey } from './schema';

export type StepKind = 'digivolve' | 'dedigivolve';
export type ForwardStepClass = 'plain' | 'item' | 'jogress';

/** Flattened per-edge requirement to digivolve from → to ('>=', ops dropped). */
export interface StepRequirement {
  agentRank: number;
  stats: Partial<Record<StatKey, number>>;
  talent?: number;
  item?: string;
  /** Jogress partners other than `from` — external prerequisites, never path-planned. */
  partners?: JogressPartner[];
  agentSkills?: AgentSkillRequirement[];
}

/**
 * Canonical per-edge classifier, shared by the planner AND graph edge styling.
 * A jogress target reached from a non-partner is a mode toggle (exactly the
 * 3 omnimon-family cases in the data) and classifies as plain.
 */
export function classifyForwardEdge(g: EvolutionGraph, from: string, to: string): ForwardStepClass {
  const cond = g.db.digimon[to].evolutionCondition;
  if (cond.jogressPartners?.some((p) => p.slug === from)) return 'jogress';
  if (cond.jogressPartners) return 'plain'; // mode toggle
  if (cond.requiredItem) return 'item';
  return 'plain';
}

export function stepRequirement(g: EvolutionGraph, from: string, to: string): StepRequirement {
  const cond = g.db.digimon[to].evolutionCondition;
  const cls = classifyForwardEdge(g, from, to);
  const stats: Partial<Record<StatKey, number>> = {};
  for (const [key, threshold] of Object.entries(cond.stats ?? {})) {
    stats[key as StatKey] = threshold!.value;
  }
  const req: StepRequirement = { agentRank: cond.agentRank.value, stats };
  if (cond.talent) req.talent = cond.talent.value;
  if (cls === 'item') req.item = cond.requiredItem;
  if (cls === 'jogress') req.partners = cond.jogressPartners!.filter((p) => p.slug !== from);
  if (cond.agentSkills) req.agentSkills = cond.agentSkills;
  return req;
}

export interface CostTable {
  // One de-digivolve action. Treated as always path-legal here (no stat/rank
  // gate). The real in-game precondition — the target already met, or the
  // Digimon's personality matching the target's base — is player save-state we
  // can't know, so it's surfaced per-step in the UI rather than modelled here.
  devolve: number;
  evolve: number;            // one plain digivolve; slightly above devolve so
                             //   unconditional descents win cost ties
  itemSurcharge: number;     // added to evolve on item-gated steps
  jogressSurcharge: number;  // added to evolve on jogress steps
}

export const DEFAULT_COSTS: CostTable = {
  devolve: 100,
  evolve: 105,
  itemSurcharge: 150,
  jogressSurcharge: 200,
};

/**
 * Jogress surcharge applied when `avoidJogress` is on. It's a penalty, not a
 * ban: jogress edges stay reachable so a route still surfaces when jogress is
 * the only way ("if possible"). The value must exceed the cost of ANY whole
 * jogress-free path so a single jogress step always outweighs any jogress-free
 * detour — the graph has a few hundred nodes and no edge costs more than
 * evolve + itemSurcharge (255), bounding a loopless path well under 1e6.
 */
export const AVOID_JOGRESS_SURCHARGE = 1_000_000;

export interface RouteStep {
  from: string;
  to: string;
  kind: StepKind;
  class: ForwardStepClass | null;      // null for dedigivolve
  cost: number;
  requirement: StepRequirement | null; // null for dedigivolve
}

export interface RouteSummary {
  maxAgentRank: number;
  maxStats: Partial<Record<StatKey, number>>;
  maxTalent?: number;
  items: string[];
  partners: JogressPartner[];
  agentSkills: AgentSkillRequirement[];
  counts: { digivolves: number; dedigivolves: number; jogressSteps: number; itemSteps: number };
}

export interface Route {
  from: string;
  to: string;
  steps: RouteStep[];
  totalCost: number;
}

export interface RoutePlannerOptions {
  k?: number;
  costs?: Partial<CostTable>;
  /** Skip digivolve arcs whose target demands a higher agent rank (start node exempt; devolves unaffected). */
  maxAgentRank?: number;
  /** Heavily penalise jogress/DNA steps so jogress-free routes always rank first,
   *  while keeping jogress reachable as a fallback when it's the only way. */
  avoidJogress?: boolean;
}

interface Arc { to: string; kind: StepKind; cost: number; }

type ArcId = string; // `${from}->${to}:${kind}` — kinds are parallel arcs on 2-cycles

const arcId = (from: string, to: string, kind: StepKind): ArcId => `${from}->${to}:${kind}`;

function forwardCost(g: EvolutionGraph, from: string, to: string, costs: CostTable): number {
  const cls = classifyForwardEdge(g, from, to);
  if (cls === 'item') return costs.evolve + costs.itemSurcharge;
  if (cls === 'jogress') return costs.evolve + costs.jogressSurcharge;
  return costs.evolve;
}

function neighbors(
  g: EvolutionGraph,
  from: string,
  costs: CostTable,
  maxAgentRank: number | undefined,
): Arc[] {
  const arcs: Arc[] = [];
  for (const to of g.out.get(from) ?? []) {
    if (maxAgentRank !== undefined && g.db.digimon[to].evolutionCondition.agentRank.value > maxAgentRank) {
      continue;
    }
    const cost = forwardCost(g, from, to, costs);
    if (Number.isFinite(cost)) arcs.push({ to, kind: 'digivolve', cost });
  }
  for (const to of g.inn.get(from) ?? []) {
    if (Number.isFinite(costs.devolve)) arcs.push({ to, kind: 'dedigivolve', cost: costs.devolve });
  }
  return arcs;
}

class MinHeap {
  private items: { key: string; cost: number }[] = [];
  get size() { return this.items.length; }
  push(key: string, cost: number) {
    const a = this.items;
    a.push({ key, cost });
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].cost <= a[i].cost) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): { key: string; cost: number } | undefined {
    const a = this.items;
    if (!a.length) return undefined;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l].cost < a[m].cost) m = l;
        if (r < a.length && a[r].cost < a[m].cost) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

interface PathResult { nodes: string[]; steps: { kind: StepKind; cost: number }[]; totalCost: number; }

function dijkstra(
  g: EvolutionGraph,
  from: string,
  to: string,
  costs: CostTable,
  maxAgentRank: number | undefined,
  bannedArcs: ReadonlySet<ArcId>,
  bannedNodes: ReadonlySet<string>,
): PathResult | null {
  const dist = new Map<string, number>();
  const prev = new Map<string, { node: string; kind: StepKind; cost: number }>();
  const done = new Set<string>();
  const heap = new MinHeap();
  dist.set(from, 0);
  heap.push(from, 0);

  while (heap.size) {
    const { key: cur, cost: d } = heap.pop()!;
    if (done.has(cur)) continue;
    done.add(cur);
    if (cur === to) break;
    for (const arc of neighbors(g, cur, costs, maxAgentRank)) {
      if (bannedNodes.has(arc.to)) continue;
      if (bannedArcs.has(arcId(cur, arc.to, arc.kind))) continue;
      const nd = d + arc.cost;
      if (nd < (dist.get(arc.to) ?? Infinity)) {
        dist.set(arc.to, nd);
        prev.set(arc.to, { node: cur, kind: arc.kind, cost: arc.cost });
        heap.push(arc.to, nd);
      }
    }
  }

  if (!done.has(to)) return null;
  const nodes: string[] = [to];
  const steps: { kind: StepKind; cost: number }[] = [];
  let cur = to;
  while (cur !== from) {
    const p = prev.get(cur)!;
    steps.unshift({ kind: p.kind, cost: p.cost });
    nodes.unshift(p.node);
    cur = p.node;
  }
  return { nodes, steps, totalCost: dist.get(to)! };
}

function toRoute(g: EvolutionGraph, path: PathResult): Route {
  const steps: RouteStep[] = path.nodes.slice(0, -1).map((from, i) => {
    const to = path.nodes[i + 1];
    const { kind, cost } = path.steps[i];
    if (kind === 'digivolve') {
      return { from, to, kind, class: classifyForwardEdge(g, from, to), cost, requirement: stepRequirement(g, from, to) };
    }
    return { from, to, kind, class: null, cost, requirement: null };
  });
  return {
    from: path.nodes[0],
    to: path.nodes[path.nodes.length - 1],
    steps,
    totalCost: path.totalCost,
  };
}

/**
 * K shortest loopless routes (Yen's algorithm over Dijkstra), sorted by
 * (totalCost, step count). Routes are single-Digimon: jogress partners are
 * displayed prerequisites, never path-planned.
 */
export function findRoutes(
  g: EvolutionGraph,
  from: string,
  to: string,
  opts: RoutePlannerOptions = {},
): Route[] {
  if (!g.db.digimon[from]) throw new Error(`Unknown slug: ${from}`);
  if (!g.db.digimon[to]) throw new Error(`Unknown slug: ${to}`);
  const k = opts.k ?? 3;
  const costs: CostTable = { ...DEFAULT_COSTS, ...opts.costs };
  if (opts.avoidJogress) {
    // Math.max so an explicit Infinity surcharge (hard exclude) still wins.
    costs.jogressSurcharge = Math.max(costs.jogressSurcharge, AVOID_JOGRESS_SURCHARGE);
  }

  if (from === to) {
    return [{ from, to, steps: [], totalCost: 0 }];
  }

  const best = dijkstra(g, from, to, costs, opts.maxAgentRank, new Set(), new Set());
  if (!best) return [];

  const accepted: PathResult[] = [best];
  const seen = new Set<string>([best.nodes.join('|')]);
  const candidates: PathResult[] = [];

  while (accepted.length < k) {
    const lastPath = accepted[accepted.length - 1];
    for (let i = 0; i < lastPath.nodes.length - 1; i++) {
      const spurNode = lastPath.nodes[i];
      const rootNodes = lastPath.nodes.slice(0, i + 1);
      const rootSteps = lastPath.steps.slice(0, i);

      const bannedArcs = new Set<ArcId>();
      for (const p of accepted) {
        if (p.nodes.length > i && rootNodes.every((n, j) => p.nodes[j] === n)) {
          bannedArcs.add(arcId(p.nodes[i], p.nodes[i + 1], p.steps[i].kind));
        }
      }
      const bannedNodes = new Set(rootNodes.slice(0, -1)); // loopless: exclude root path except spur

      const spur = dijkstra(g, spurNode, to, costs, opts.maxAgentRank, bannedArcs, bannedNodes);
      if (!spur) continue;

      const nodes = [...rootNodes.slice(0, -1), ...spur.nodes];
      const steps = [...rootSteps, ...spur.steps];
      const key = nodes.join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({ nodes, steps, totalCost: steps.reduce((a, s) => a + s.cost, 0) });
    }
    if (!candidates.length) break;
    candidates.sort((a, b) => a.totalCost - b.totalCost || a.steps.length - b.steps.length);
    accepted.push(candidates.shift()!);
  }

  return accepted
    .map((p) => toRoute(g, p))
    .sort((a, b) => a.totalCost - b.totalCost || a.steps.length - b.steps.length);
}
