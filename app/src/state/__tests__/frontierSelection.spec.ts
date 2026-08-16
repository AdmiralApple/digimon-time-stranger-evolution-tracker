import { beforeEach, describe, expect, it } from 'vitest';
import { revealedSet, useStore, type DiscoveryState } from '../store';

const emptyDiscovery = (): DiscoveryState => ({
  mode: true,
  frontier: true,
  player: null,
  discovered: new Set(['agumon']),
  registered: new Set(),
  scanPct: {},
  manual: new Set(),
});

describe('frontier silhouette selection', () => {
  beforeEach(() => {
    useStore.setState({
      selected: null,
      frontierSelected: null,
      discovery: emptyDiscovery(),
    });
  });

  it('hands selection from a revealed node to an anonymous frontier target', () => {
    useStore.getState().select('agumon');
    useStore.getState().selectFrontier('greymon');

    expect(useStore.getState().selected).toBeNull();
    expect(useStore.getState().frontierSelected).toBe('greymon');
  });

  it('reveals the target without toggling it back off, then opens normal selection', () => {
    const store = useStore.getState();
    store.selectFrontier('greymon');
    store.reveal('greymon');
    store.reveal('greymon');
    store.select('greymon');

    const state = useStore.getState();
    expect(revealedSet(state.discovery).has('greymon')).toBe(true);
    expect(state.discovery.manual.has('greymon')).toBe(true);
    expect(state.frontierSelected).toBeNull();
    expect(state.selected).toBe('greymon');
  });
});
