import { useEffect } from 'react';
import { useStore } from '../state/store';
import { applyAccent } from './chroma';

/**
 * Drives the app's chromatic identity: whenever the selected Digimon changes,
 * repaint the accent ramp with that character's signature hue (or the brand
 * amber when nothing is selected). The whole UI shifts as you explore.
 */
export function useChromaticAccent(): void {
  useEffect(() => {
    applyAccent(useStore.getState().selected);
    return useStore.subscribe(
      (s) => s.selected,
      (selected) => applyAccent(selected),
    );
  }, []);
}
