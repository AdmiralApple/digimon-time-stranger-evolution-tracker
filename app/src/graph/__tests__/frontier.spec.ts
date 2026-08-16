import { describe, expect, it } from 'vitest';
import { frontierNodes, revealedFrontierConnections } from '../frontier';

const graph = {
  out: new Map<string, readonly string[]>([
    ['revealed-a', ['frontier']],
    ['frontier', ['hidden-two-hops', 'revealed-b']],
    ['hidden-two-hops', []],
    ['revealed-b', []],
    ['disconnected', []],
  ]),
  inn: new Map<string, readonly string[]>([
    ['revealed-a', []],
    ['frontier', ['revealed-a']],
    ['hidden-two-hops', ['frontier']],
    ['revealed-b', ['frontier']],
    ['disconnected', []],
  ]),
};

describe('spoiler-free frontier', () => {
  const revealed = new Set(['revealed-a', 'revealed-b']);

  it('contains only unrevealed nodes directly connected to revealed nodes', () => {
    expect([...frontierNodes(graph, revealed)]).toEqual(['frontier']);
  });

  it('returns every revealed connection for a clicked silhouette', () => {
    expect(revealedFrontierConnections(graph, revealed, 'frontier')).toEqual([
      ['revealed-a', 'frontier'],
      ['frontier', 'revealed-b'],
    ]);
  });

  it('returns no links for an unrevealed node beyond the one-hop frontier', () => {
    expect(revealedFrontierConnections(graph, revealed, 'hidden-two-hops')).toEqual([]);
  });
});
