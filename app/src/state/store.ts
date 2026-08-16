import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { appData } from '../data/appData';
import { lineage } from '../data/graph';
import type { Orientation } from '../graph/orient';
import { GRAPH_ORDERS, type GraphOrder } from '../graph/order';
import { findRoutes, type Route } from '../data/route';
import {
  AGENT_SKILL_CATEGORIES,
  clampStacks,
  EMPTY_AGENT_SKILLS,
  type AgentSkillStacks,
} from '../data/agentSkills';
import type { AgentSkillCategory, Attribute, Generation, Personality, StatLevel } from '../data/schema';
import type { SpecialFacet } from '../data/search';
import type { SortKey as CodexSortKey } from '../codex/codexRows';
import { parseSave, type SaveProgress } from '../data/saveImport';

// Display preferences persist across sessions (localStorage). Orientation
// defaults to rows — the many-members-per-stage spread reads best sideways;
// portrait screens can switch to columns. Focus defaults to hiding the rest of
// the graph so the focused lineage / route stands alone.
const PREFS_KEY = 'tst:prefs';
interface Prefs {
  orientation: Orientation;
  graphOrder: GraphOrder;
  hideOthers: boolean;
  /** Owned Bond Agent-Skill stacks (0..4 each) used to preview reduced stat reqs. */
  agentSkills: AgentSkillStacks;
}
const DEFAULT_PREFS: Prefs = {
  orientation: 'rows',
  graphOrder: 'connections',
  hideOthers: true,
  agentSkills: EMPTY_AGENT_SKILLS,
};

/** Defensively coerce a persisted (or hand-edited) blob into valid stack counts. */
function parseStacks(raw: unknown): AgentSkillStacks {
  const out: AgentSkillStacks = { ...EMPTY_AGENT_SKILLS };
  if (raw && typeof raw === 'object') {
    for (const cat of AGENT_SKILL_CATEGORIES) {
      const v = (raw as Record<string, unknown>)[cat];
      if (typeof v === 'number') out[cat] = clampStacks(v);
    }
  }
  return out;
}

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const p = JSON.parse(raw) as Partial<Prefs> & { focusHides?: boolean };
    return {
      orientation: p.orientation === 'columns' ? 'columns' : 'rows',
      graphOrder: GRAPH_ORDERS.includes(p.graphOrder as GraphOrder)
        ? (p.graphOrder as GraphOrder)
        : 'connections',
      // `focusHides` is the pre-generalisation key — read it as a fallback
      hideOthers: (p.hideOthers ?? p.focusHides) !== false,
      agentSkills: parseStacks(p.agentSkills),
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(prefs: Prefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* private mode / disabled storage — preference just won't persist */
  }
}

/** Pull the persistable slice out of the live store state (single source for saves). */
function snapshotPrefs(s: Prefs): Prefs {
  return {
    orientation: s.orientation,
    graphOrder: s.graphOrder,
    hideOthers: s.hideOthers,
    agentSkills: s.agentSkills,
  };
}

// --- Field Guide discovery (fog-of-war), persisted separately from display prefs.
// Imported from a save file (discovered/registered/scan%) and/or hand-revealed;
// survives reloads so you re-import only when your save advances.
const DISCOVERY_KEY = 'tst:discovery';
export interface DiscoveryState {
  /** Spoiler-free fog on: undiscovered Digimon hide until you meet them. */
  mode: boolean;
  /** Silhouette (vs fully hide) the undiscovered Digimon adjacent to a revealed one. */
  frontier: boolean;
  /** Player name from the last imported save (for the "loaded X" note). */
  player: string | null;
  /** Species seen in-game (drives reveal). */
  discovered: ReadonlySet<string>;
  /** Species registered in the Field Guide. */
  registered: ReadonlySet<string>;
  /** slug → scan % from the save. */
  scanPct: Record<string, number>;
  /** Species hand-revealed in the app (independent of the save). */
  manual: ReadonlySet<string>;
}

const EMPTY_DISCOVERY: DiscoveryState = {
  mode: false,
  frontier: true,
  player: null,
  discovered: new Set(),
  registered: new Set(),
  scanPct: {},
  manual: new Set(),
};

function loadDiscovery(): DiscoveryState {
  try {
    const raw = localStorage.getItem(DISCOVERY_KEY);
    if (!raw) return EMPTY_DISCOVERY;
    const p = JSON.parse(raw) as Record<string, unknown>;
    const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
    return {
      mode: p.mode === true,
      frontier: p.frontier !== false,
      player: typeof p.player === 'string' ? p.player : null,
      discovered: new Set(arr(p.discovered)),
      registered: new Set(arr(p.registered)),
      scanPct: p.scanPct && typeof p.scanPct === 'object' ? (p.scanPct as Record<string, number>) : {},
      manual: new Set(arr(p.manual)),
    };
  } catch {
    return EMPTY_DISCOVERY;
  }
}

function saveDiscovery(d: DiscoveryState): void {
  try {
    localStorage.setItem(
      DISCOVERY_KEY,
      JSON.stringify({
        mode: d.mode,
        frontier: d.frontier,
        player: d.player,
        discovered: [...d.discovered],
        registered: [...d.registered],
        scanPct: d.scanPct,
        manual: [...d.manual],
      }),
    );
  } catch {
    /* storage disabled — discovery just won't persist */
  }
}

/** The set the fog treats as "revealed": everything seen in-game or by hand. */
export function revealedSet(d: DiscoveryState): ReadonlySet<string> {
  if (d.manual.size === 0) return d.discovered;
  const s = new Set(d.discovered);
  for (const slug of d.manual) s.add(slug);
  return s;
}

export interface RouteState {
  from: string | null;
  to: string | null;
  maxAgentRank: number | null;
  /** Prefer routes with no jogress/DNA step, falling back to jogress only when
   *  there's no other way. Off by default. Session-only (not URL-persisted). */
  avoidJogress: boolean;
  routes: Route[] | null;
  active: number;
  activeStep: number | null;
}

const emptyRoute: RouteState = {
  from: null,
  to: null,
  maxAgentRank: null,
  avoidJogress: false,
  routes: null,
  active: 0,
  activeStep: null,
};

/** Codex table controls, held here (not in the component) so sort / filters /
 *  level survive switching to the Tree and back — the Codex unmounts each time. */
export interface CodexState {
  query: string;
  generations: ReadonlySet<Generation>;
  attributes: ReadonlySet<Attribute>;
  level: StatLevel;
  sortKey: CodexSortKey;
  sortDir: 'asc' | 'desc';
  // Advanced facets (see codex/codexFilter). The special-skill facet has two
  // sub-facets — `skillElements` (element/effect keys) and `skillTypes`
  // (magic/physical) — combined same-skill. `resist` / `weak` hold namespaced
  // resistance keys (`el:*`) — a key lives in at most one of the two.
  skillElements: ReadonlySet<string>;
  skillTypes: ReadonlySet<string>;
  resist: ReadonlySet<string>;
  weak: ReadonlySet<string>;
  // Trait facets (item / jogress / bond / ridable) — the same set the Tree filter
  // offers, mirrored into the Field Guide's advanced filters. OR within.
  special: ReadonlySet<SpecialFacet>;
  // Base personality — the same facet the Tree offers (via its popover), mirrored
  // into the advanced filters. OR within.
  personalities: ReadonlySet<Personality>;
}

const emptyCodex: CodexState = {
  query: '',
  generations: new Set(),
  attributes: new Set(),
  level: 'lv99',
  sortKey: 'number',
  sortDir: 'asc',
  skillElements: new Set(),
  skillTypes: new Set(),
  resist: new Set(),
  weak: new Set(),
  special: new Set(),
  personalities: new Set(),
};

/** Top-level surface: the evolution graph, or the flat Codex table. */
export type AppView = 'graph' | 'codex';

export interface AppState {
  ready: boolean;
  view: AppView;
  selected: string | null;
  focus: string | null;
  /** Branches the user has pruned out of the *currently focused* lineage, to cut
   *  clutter when the endpoint isn't decided yet. Each excluded slug — and
   *  anything reachable only through it — drops from the focus view. Scoped to
   *  the current focus: cleared whenever `focus` changes. Session-only (not
   *  URL-persisted), like `route.avoidJogress`. */
  lineageExcluded: ReadonlySet<string>;
  // Tree filters: attribute + trait + base personality. Generation is the graph's
  // spatial axis, so it isn't a tree filter (the Codex keeps its own generation
  // filter, codex.*). Personality is offered via a popover (16 in 4 bonds) so the
  // bar stays one row on mobile.
  attributes: ReadonlySet<Attribute>;
  special: ReadonlySet<SpecialFacet>;
  personalities: ReadonlySet<Personality>;
  filtersOpen: boolean;
  route: RouteState;
  routeOpen: boolean;
  orientation: Orientation;
  graphOrder: GraphOrder;
  /** Isolate mode: hide (vs dim) everything outside the focused lineage / route. */
  hideOthers: boolean;
  /** Owned Bond Agent-Skill stacks (0..4 each), previewing reduced stat reqs. */
  agentSkills: AgentSkillStacks;
  settingsOpen: boolean;
  codex: CodexState;
  /** Field Guide fog-of-war state (import + reveal). */
  discovery: DiscoveryState;

  setReady(): void;
  /** Decrypt + parse a save file's bytes and load its Field Guide progress. */
  importSave(bytes: Uint8Array): { discovered: number; registered: number; player: string };
  setDiscoveryMode(on: boolean): void;
  setFrontier(on: boolean): void;
  /** Hand-reveal (or re-hide) one species, independent of any imported save. */
  toggleReveal(slug: string): void;
  /** Forget all imported/hand-revealed progress. */
  clearDiscovery(): void;
  patchCodex(patch: Partial<CodexState>): void;
  setView(view: AppView): void;
  /** Codex → Tree: select a Digimon and show it in the graph. Deliberately does
   *  NOT focus — the detail panel then offers "Focus lineage" so the pick can be
   *  isolated on demand (rather than arriving pre-focused). */
  openInTree(slug: string): void;
  select(slug: string | null): void;
  setFocus(slug: string | null): void;
  /** Prune a branch out of the focused lineage. No-op outside focus, or on the
   *  focus itself. Clears the selection if it was the branch being hidden. */
  excludeFromLineage(slug: string): void;
  /** Bring a pruned branch back into the focused lineage. */
  restoreToLineage(slug: string): void;
  /** Restore every pruned branch. */
  clearLineageExclusions(): void;
  setOrientation(value: Orientation): void;
  setGraphOrder(value: GraphOrder): void;
  setHideOthers(value: boolean): void;
  setAgentSkill(category: AgentSkillCategory, value: number): void;
  setSettingsOpen(open: boolean): void;
  toggleAttribute(value: Attribute): void;
  toggleSpecial(value: SpecialFacet): void;
  togglePersonality(value: Personality): void;
  /** Replace the whole personality set (bond "select all", popover clear). */
  setPersonalities(next: ReadonlySet<Personality>): void;
  clearFilters(): void;
  setFiltersOpen(open: boolean): void;
  openRoute(partial?: Partial<Pick<RouteState, 'from' | 'to'>>): void;
  closeRoute(): void;
  setRouteEndpoint(which: 'from' | 'to', slug: string | null): void;
  swapRoute(): void;
  setMaxAgentRank(value: number | null): void;
  setAvoidJogress(value: boolean): void;
  setActiveRoute(index: number): void;
  setActiveStep(index: number | null): void;
}

/** Immutable set toggle: returns a new set with `value` added or removed. */
export function toggled<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function computeRoutes(route: RouteState): RouteState {
  if (!route.from || !route.to) return { ...route, routes: null, active: 0, activeStep: null };
  const routes = findRoutes(appData().graph, route.from, route.to, {
    k: 3,
    maxAgentRank: route.maxAgentRank ?? undefined,
    avoidJogress: route.avoidJogress,
  });
  return { ...route, routes, active: 0, activeStep: null };
}

export const useStore = create<AppState>()(
  subscribeWithSelector((set, get) => ({
    ready: false,
    view: 'graph',
    selected: null,
    focus: null,
    lineageExcluded: new Set<string>(),
    attributes: new Set<Attribute>(),
    special: new Set<SpecialFacet>(),
    personalities: new Set<Personality>(),
    filtersOpen: false,
    route: emptyRoute,
    routeOpen: false,
    ...loadPrefs(),
    settingsOpen: false,
    codex: emptyCodex,
    discovery: loadDiscovery(),

    setReady: () => set({ ready: true }),
    importSave: (bytes) => {
      const progress: SaveProgress = parseSave(bytes);
      const next: DiscoveryState = {
        ...get().discovery,
        // Importing turns fog on — the whole point of loading a save.
        mode: true,
        player: progress.player || null,
        discovered: progress.discovered,
        registered: progress.registered,
        scanPct: progress.scanPct,
      };
      set({ discovery: next });
      saveDiscovery(next);
      return {
        discovered: progress.discovered.size,
        registered: progress.registered.size,
        player: progress.player,
      };
    },
    setDiscoveryMode: (on) => {
      const next = { ...get().discovery, mode: on };
      set({ discovery: next });
      saveDiscovery(next);
    },
    setFrontier: (on) => {
      const next = { ...get().discovery, frontier: on };
      set({ discovery: next });
      saveDiscovery(next);
    },
    toggleReveal: (slug) => {
      const d = get().discovery;
      const manual = new Set(d.manual);
      // Toggling a save-discovered species hides it via an explicit "un-reveal"
      // is out of scope; manual only *adds* reveals on top of the save.
      if (manual.has(slug)) manual.delete(slug);
      else manual.add(slug);
      const next = { ...d, manual };
      set({ discovery: next });
      saveDiscovery(next);
    },
    clearDiscovery: () => {
      const next: DiscoveryState = { ...EMPTY_DISCOVERY, frontier: get().discovery.frontier };
      set({ discovery: next });
      saveDiscovery(next);
    },
    patchCodex: (patch) => set({ codex: { ...get().codex, ...patch } }),
    // Codex is a graph-independent surface: entering it leaves the isolating
    // graph modes (focus / route) so the URL and the visible view never disagree.
    // `selected` is preserved so returning to the Tree lands where you left it.
    setView: (view) =>
      set(
        view === 'codex'
          ? { view, focus: null, routeOpen: false, lineageExcluded: new Set<string>() }
          : { view },
      ),
    openInTree: (slug) =>
      set({
        view: 'graph',
        selected: slug,
        focus: null,
        routeOpen: false,
        lineageExcluded: new Set<string>(),
      }),
    select: (slug) => set({ selected: slug }),
    // Focus and the route planner are mutually exclusive views (as the URL model
    // already assumes): a route can devolve out of a lineage, which can't be shown
    // inside a focus that isolates — and compacts — only that lineage. Entering
    // focus closes any open route. Exclusions belong to the lineage being left,
    // so any focus change (in, out, or to a different anchor) clears them.
    setFocus: (slug) =>
      set(
        slug
          ? { focus: slug, routeOpen: false, lineageExcluded: new Set<string>() }
          : { focus: null, lineageExcluded: new Set<string>() },
      ),
    excludeFromLineage: (slug) => {
      const { focus, lineageExcluded, selected } = get();
      if (!focus || slug === focus || lineageExcluded.has(slug)) return;
      const next = new Set(lineageExcluded);
      next.add(slug);
      // Hiding a branch prunes it AND anything only reachable through it. If that
      // strands the current selection outside the recomputed lineage — whether
      // it's the hidden branch itself or a node that only connected via it — drop
      // back to the lineage overview rather than describing a now-hidden node.
      const selectionStrands =
        selected !== null &&
        selected !== focus &&
        !lineage(appData().graph, focus, next).nodes.has(selected);
      set({ lineageExcluded: next, selected: selectionStrands ? null : selected });
    },
    restoreToLineage: (slug) => {
      const next = new Set(get().lineageExcluded);
      if (!next.delete(slug)) return;
      set({ lineageExcluded: next });
    },
    clearLineageExclusions: () =>
      set(get().lineageExcluded.size ? { lineageExcluded: new Set<string>() } : {}),
    setOrientation: (value) => {
      set({ orientation: value });
      savePrefs(snapshotPrefs(get()));
    },
    setGraphOrder: (value) => {
      set({ graphOrder: value });
      savePrefs(snapshotPrefs(get()));
    },
    setHideOthers: (value) => {
      set({ hideOthers: value });
      savePrefs(snapshotPrefs(get()));
    },
    setAgentSkill: (category, value) => {
      set({ agentSkills: { ...get().agentSkills, [category]: clampStacks(value) } });
      savePrefs(snapshotPrefs(get()));
    },
    setSettingsOpen: (open) => set({ settingsOpen: open }),
    toggleAttribute: (value) => set({ attributes: toggled(get().attributes, value) }),
    toggleSpecial: (value) => set({ special: toggled(get().special, value) }),
    togglePersonality: (value) => set({ personalities: toggled(get().personalities, value) }),
    setPersonalities: (next) => set({ personalities: next }),
    clearFilters: () => set({ attributes: new Set(), special: new Set(), personalities: new Set() }),
    setFiltersOpen: (open) => set({ filtersOpen: open }),

    openRoute: (partial) =>
      set({
        routeOpen: true,
        focus: null, // route and focus are mutually exclusive (see setFocus)
        lineageExcluded: new Set<string>(), // leaving focus drops its exclusions
        route: computeRoutes({ ...get().route, ...partial }),
      }),
    closeRoute: () => set({ routeOpen: false }),
    setRouteEndpoint: (which, slug) =>
      set({ route: computeRoutes({ ...get().route, [which]: slug }) }),
    // Reverse the journey: exchange endpoints and re-solve. Reuses the same
    // compute path as setRouteEndpoint, so the URL (#/route/from/to) follows.
    swapRoute: () => {
      const { from, to } = get().route;
      set({ route: computeRoutes({ ...get().route, from: to, to: from }) });
    },
    setMaxAgentRank: (value) =>
      set({ route: computeRoutes({ ...get().route, maxAgentRank: value }) }),
    setAvoidJogress: (value) =>
      set({ route: computeRoutes({ ...get().route, avoidJogress: value }) }),
    setActiveRoute: (index) =>
      set({ route: { ...get().route, active: index, activeStep: null } }),
    setActiveStep: (index) => set({ route: { ...get().route, activeStep: index } }),
  })),
);
