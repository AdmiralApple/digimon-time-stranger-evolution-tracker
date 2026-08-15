import type { Core } from 'cytoscape';

// The cytoscape instance is a module singleton — never React state. React
// components and store controllers reach it through getCy().
let instance: Core | null = null;

export function registerCy(cy: Core): void {
  instance = cy;
}

export function unregisterCy(): void {
  instance = null;
}

export function getCy(): Core | null {
  return instance;
}
