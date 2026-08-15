// Attack-type classification for skills. The game records a skill's type only in
// its description prose — "Performs <element> magic|physical attack" — never as a
// field, so we read it out here. Pure and dependency-free like the rest of
// src/data/; consumed by the Codex filter and the detail-panel skill list.

export type AttackType = 'magic' | 'physical';
export const ATTACK_TYPES: readonly AttackType[] = ['magic', 'physical'];

// Anchor on "Performs" so we classify the skill's OWN attack and ignore counter
// clauses ("…counters with a Null magic attack") that some buff skills describe.
// The element word is optional — most skills read "Performs <element> <type>
// attack", but some drop straight to the type ("Performs phys. attack of random
// power/element/effect…"), which also appears abbreviated (phys. / mag.).
// Non-attacks (buffs / heals) match nothing → null.
const ATTACK_RE = /performs\s+(?:\w+\s+)?(magic(?:al)?|physical|phys\.?|mag\.?)\s+attack/i;

export function classifyAttackType(description: string): AttackType | null {
  const m = ATTACK_RE.exec(description ?? '');
  if (!m) return null;
  return m[1].toLowerCase().startsWith('mag') ? 'magic' : 'physical';
}
