import { Fragment, useMemo, type ReactNode } from 'react';
import { appData } from '../../data/appData';
import { lineage } from '../../data/graph';
import {
  PERSONALITY_CATEGORY,
  reduceStat,
  reductionPct,
  stacksForPersonality,
} from '../../data/agentSkills';
import type { Digimon } from '../../data/schema';
import { useStore } from '../../state/store';
import { MonRow } from '../../ui/MonRow';
import styles from './EvolutionLinks.module.css';

/** A mode change is a reciprocal (2-cycle) evolution — `a` and `b` each evolve
 *  into the other, i.e. a switchable alternate form (Spirit Human/Beast,
 *  X-Antibody, Alter, DM/FM modes, …). Symmetric, so it holds whether `b` is a
 *  pre- or post-evolution of `a`. */
const isModeChange = (a: Digimon, bSlug: string): boolean => {
  const b = appData().db.digimon[bSlug];
  return !!b && a.evolvesTo.includes(bSlug) && b.evolvesTo.includes(a.slug);
};

const modeChangeTag = (
  <span className={styles.modeChange} title="Switchable alternate form — evolves back and forth">
    ⇄ Mode change
  </span>
);

/**
 * Compact summary of a target's evolution condition, *excluding* agent rank
 * (rank rides beside the target's name — see the Evolves-to rows below — since
 * effectively every evolution has one). Returns `undefined` when nothing but
 * rank is required, so the row shows no sub-line at all.
 *
 * When the player's Agent Skills reduce this target's bond, each stat shows the
 * base struck through next to the reduced value (the chips' dual read), led by
 * the ❖ bond glyph, wrapping so nothing is clipped. `stacks` is already resolved
 * for the target's personality.
 */
function microSummary(target: Digimon, stacks: number): ReactNode {
  const cond = target.evolutionCondition;
  const statEntries = Object.entries(cond.stats ?? {});
  const reduced = stacks > 0 && statEntries.length > 0;

  // Non-reduced: a compact one-liner of the varying requirements (no rank).
  if (!reduced) {
    const parts: string[] = [];
    for (const [stat, threshold] of statEntries) parts.push(`${stat} ${threshold!.value}`);
    if (cond.talent) parts.push(`Tal ${cond.talent.value}`);
    if (cond.requiredItem) parts.push('◆ item');
    if (cond.jogressPartners) parts.push('⧉ Jogress/DNA');
    if (cond.agentSkills) parts.push('❖ bond');
    return parts.length ? parts.slice(0, 3).join(' · ') : undefined;
  }

  // Reduced: `base → reduced` per stat, wrapping so both numbers always show.
  const nodes: ReactNode[] = [];
  for (const [stat, threshold] of statEntries) {
    const base = threshold!.value;
    nodes.push(
      <span key={stat}>
        {stat} <span className={styles.wasStat}>{base}</span>
        <span className={styles.arrow} aria-hidden="true">→</span>
        <span className={styles.nowStat}>{reduceStat(base, stacks)}</span>
      </span>,
    );
  }
  if (cond.talent) nodes.push(<span key="tal">Tal {cond.talent.value}</span>);
  if (cond.requiredItem) nodes.push(<span key="item">◆ item</span>);
  if (cond.jogressPartners) nodes.push(<span key="jog">⧉ Jogress/DNA</span>);
  if (cond.agentSkills) nodes.push(<span key="bond">❖ bond</span>);

  return (
    <span
      className={styles.reduced}
      title={`Stat requirements reduced ${reductionPct(stacks)}% (${PERSONALITY_CATEGORY[target.basePersonality]}) with a matching source`}
    >
      <span className={styles.reducedGlyph} aria-hidden="true">
        ❖{' '}
      </span>
      {/* Each stat is a nowrap block; only the ` · ` separators are break points,
          so a stat never splits across lines (label on one, values on the next). */}
      {nodes.map((node, i) => (
        <Fragment key={i}>
          {i > 0 && <span className={styles.sep}> · </span>}
          <span className={styles.part}>{node}</span>
        </Fragment>
      ))}
    </span>
  );
}

/** An evolution neighbour: sprite + name, its base personality (right), and an
 *  optional condition sub-line. Personality is load-bearing when planning
 *  evolutions, so it rides along on every link.
 *
 *  While a lineage is focused, any neighbour that belongs to the focused family
 *  gains a trailing prune toggle — hide the branch to cut clutter, or restore a
 *  branch already hidden. The toggle is a sibling of the row (never nested in
 *  its button), so both stay valid, independent controls. */
function Row({
  slug,
  name,
  sub,
  prunable,
}: {
  slug: string;
  name?: ReactNode;
  sub?: ReactNode;
  prunable: boolean;
}) {
  const select = useStore((s) => s.select);
  const excluded = useStore((s) => s.lineageExcluded);
  const exclude = useStore((s) => s.excludeFromLineage);
  const restore = useStore((s) => s.restoreToLineage);
  const d = appData().db.digimon[slug];

  const row = (
    <MonRow
      slug={slug}
      name={name}
      sub={sub}
      className={prunable ? styles.neighbourMon : undefined}
      meta={<span className={styles.persona}>{d.basePersonality}</span>}
      title={`Base personality: ${d.basePersonality}`}
      onClick={() => select(slug)}
    />
  );

  if (!prunable) return row;

  const hidden = excluded.has(slug);
  const action = hidden
    ? `Restore ${d.name} to the focused lineage`
    : `Hide ${d.name} and its branch from the focused lineage`;
  return (
    <div className={hidden ? `${styles.neighbour} ${styles.neighbourHidden}` : styles.neighbour}>
      {row}
      <button
        type="button"
        className={styles.pruneBtn}
        aria-pressed={hidden}
        aria-label={action}
        title={action}
        onClick={() => (hidden ? restore(slug) : exclude(slug))}
      >
        <span aria-hidden="true">{hidden ? '↺' : '⊘'}</span>
      </button>
    </div>
  );
}

export function EvolutionLinks({ digimon }: { digimon: Digimon }) {
  const db = appData().db;
  const focus = useStore((s) => s.focus);
  const agentSkills = useStore((s) => s.agentSkills);
  // The focused family (ignoring current exclusions, so an already-hidden branch
  // still shows its restore toggle here). A neighbour is prunable only if it's
  // part of this family and isn't the focus itself.
  const family = useMemo(() => (focus ? lineage(appData().graph, focus).nodes : null), [focus]);
  const canPrune = (slug: string): boolean =>
    focus != null && slug !== focus && (family?.has(slug) ?? false);

  return (
    <div className={styles.wrap}>
      {digimon.evolvesFrom.length > 0 && (
        <div>
          <div className={`label ${styles.label}`}>Evolves from</div>
          {digimon.evolvesFrom.map((slug) => (
            <Row
              key={slug}
              slug={slug}
              sub={isModeChange(digimon, slug) ? modeChangeTag : undefined}
              prunable={canPrune(slug)}
            />
          ))}
        </div>
      )}
      {digimon.evolvesTo.length > 0 && (
        <div>
          <div className={`label ${styles.label}`}>Evolves to</div>
          {digimon.evolvesTo.map((slug) => {
            const target = db.digimon[slug];
            // Rank rides beside the name (near-universal); the sub-line is left
            // for the requirements that vary.
            const name = (
              <>
                {target.name}
                <span className={styles.rank}>Rk {target.evolutionCondition.agentRank.value}</span>
              </>
            );
            const cond = microSummary(target, stacksForPersonality(target.basePersonality, agentSkills));
            const mode = isModeChange(digimon, slug);
            const sub = mode ? (
              <>
                {modeChangeTag}
                {cond != null && (
                  <>
                    {' · '}
                    {cond}
                  </>
                )}
              </>
            ) : (
              cond
            );
            return <Row key={slug} slug={slug} name={name} sub={sub} prunable={canPrune(slug)} />;
          })}
        </div>
      )}
      {digimon.evolvesFrom.length === 0 && digimon.evolvesTo.length === 0 && (
        <div className={`label ${styles.label}`}>No evolution links.</div>
      )}
    </div>
  );
}
