import type { EvolutionGraph } from '../data/graph';

type AdjacencyGraph = Pick<EvolutionGraph, 'out' | 'inn'>;

/** Every unrevealed node exactly one edge away from at least one revealed node. */
export function frontierNodes(
  graph: AdjacencyGraph,
  revealed: ReadonlySet<string>,
): Set<string> {
  const frontier = new Set<string>();
  for (const slug of revealed) {
    for (const next of graph.out.get(slug) ?? []) {
      if (!revealed.has(next)) frontier.add(next);
    }
    for (const previous of graph.inn.get(slug) ?? []) {
      if (!revealed.has(previous)) frontier.add(previous);
    }
  }
  return frontier;
}

/** Directed graph edges connecting one frontier silhouette to revealed forms. */
export function revealedFrontierConnections(
  graph: AdjacencyGraph,
  revealed: ReadonlySet<string>,
  frontier: string,
): Array<readonly [from: string, to: string]> {
  const connections: Array<readonly [string, string]> = [];
  for (const from of graph.inn.get(frontier) ?? []) {
    if (revealed.has(from)) connections.push([from, frontier]);
  }
  for (const to of graph.out.get(frontier) ?? []) {
    if (revealed.has(to)) connections.push([frontier, to]);
  }
  return connections;
}
