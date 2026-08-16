export type GraphOrder = 'connections' | 'original' | 'name' | 'number';

export const GRAPH_ORDERS: readonly GraphOrder[] = [
  'connections',
  'original',
  'name',
  'number',
];

/** Full-atlas spacing authored by scripts/build-layout.mjs. */
export const GRAPH_NODE_PITCH = 104;

/**
 * Reserve consecutive visual slots around `anchorSlot` for `moved`, then pack
 * every other member back into the remaining slots without changing its order.
 * Reserved slots may extend beyond the old right edge; that is intentional — a
 * selected node near the end of a long row should not force its evolutions to
 * overlap or bunch against the final existing member.
 */
export function centeredSlots(
  ordered: readonly string[],
  moved: ReadonlySet<string>,
  anchorSlot: number,
): Map<string, number> {
  const moving = ordered.filter((slug) => moved.has(slug));
  if (!moving.length) return new Map(ordered.map((slug, index) => [slug, index]));

  const start = Math.max(0, Math.round(anchorSlot - (moving.length - 1) / 2));
  const reserved = new Set(moving.map((_, index) => start + index));
  const slots = new Map<string, number>();

  moving.forEach((slug, index) => slots.set(slug, start + index));
  let cursor = 0;
  for (const slug of ordered) {
    if (moved.has(slug)) continue;
    while (reserved.has(cursor)) cursor += 1;
    slots.set(slug, cursor);
    cursor += 1;
  }
  return slots;
}
