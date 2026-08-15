import { useEffect, useMemo, useState } from 'react';
import { appData } from '../data/appData';
import { lineage } from '../data/graph';
import { iconUrl } from '../data/load';
import { useStore } from '../state/store';
import { ATTRIBUTE_COLORS } from '../theme/attribute';
import { Chip } from '../ui/Chip';
import { Collapse } from '../ui/Collapse';
import { Panel, CloseButton } from '../ui/Panel';
import { SegButton } from '../ui/SegButton';
import { ConditionCard } from './sections/ConditionCard';
import { DialogueBlock } from './sections/DialogueBlock';
import { EvolutionLinks } from './sections/EvolutionLinks';
import { PersonalityTable } from './sections/PersonalityTable';
import { ResistanceGrid } from './sections/ResistanceGrid';
import { SkillList } from './sections/SkillList';
import { StatBars } from './sections/StatBars';
import styles from './DetailPanel.module.css';

export function DetailPanel({ slug }: { slug: string }) {
  const select = useStore((s) => s.select);
  const setFocus = useStore((s) => s.setFocus);
  const openRoute = useStore((s) => s.openRoute);
  const focus = useStore((s) => s.focus);
  const lineageExcluded = useStore((s) => s.lineageExcluded);
  const excludeFromLineage = useStore((s) => s.excludeFromLineage);
  const digimon = appData().db.digimon[slug];
  const [descExpanded, setDescExpanded] = useState(false);

  useEffect(() => setDescExpanded(false), [slug]);

  // A branch can be pruned only while focused, and only for a member of the
  // focused lineage that isn't the focus itself.
  const canHideBranch = useMemo(
    () =>
      focus != null &&
      slug !== focus &&
      lineage(appData().graph, focus, lineageExcluded).nodes.has(slug),
    [focus, lineageExcluded, slug],
  );

  return (
    <Panel>
      <header className={styles.header}>
        <img
          className={styles.icon}
          src={iconUrl(slug)}
          alt={digimon.name}
          width={64}
          height={64}
          style={{ borderColor: ATTRIBUTE_COLORS[digimon.attribute] }}
        />
        <div className={styles.titleBlock}>
          <div className={styles.nameRow}>
            <h2 className={styles.name}>{digimon.name}</h2>
            <span className={styles.number}>#{String(digimon.number).padStart(3, '0')}</span>
          </div>
          <div className={styles.chips}>
            <Chip>{digimon.generation}</Chip>
            <Chip color={ATTRIBUTE_COLORS[digimon.attribute]}>{digimon.attribute}</Chip>
            <Chip>{digimon.type}</Chip>
            {digimon.ridable && <Chip title="Ridable">🐎 Ridable</Chip>}
          </div>
        </div>
        <CloseButton onClick={() => select(null)} title="Close (Esc)" />
      </header>

      <div className={styles.actions}>
        <SegButton
          size="sm"
          active={focus === slug}
          onClick={() => setFocus(focus === slug ? null : slug)}
          title="Isolate this Digimon's full lineage (F)"
        >
          ◈ {focus === slug ? 'Unfocus' : 'Focus lineage'}
        </SegButton>
        {canHideBranch && (
          <SegButton
            size="sm"
            onClick={() => excludeFromLineage(slug)}
            title="Remove this Digimon — and any line reached only through it — from the focused lineage"
          >
            ⊘ Hide branch
          </SegButton>
        )}
        <SegButton size="sm" onClick={() => openRoute({ from: slug })}>
          Route from
        </SegButton>
        <SegButton size="sm" onClick={() => openRoute({ to: slug })}>
          Route to
        </SegButton>
      </div>

      <div className={styles.scroll}>
        <button
          type="button"
          className={descExpanded ? styles.descFull : styles.desc}
          onClick={() => setDescExpanded(!descExpanded)}
          aria-expanded={descExpanded}
          title={descExpanded ? 'Collapse' : 'Expand'}
        >
          {digimon.description}
        </button>

        <ConditionCard
          condition={digimon.evolutionCondition}
          basePersonality={digimon.basePersonality}
        />
        <EvolutionLinks digimon={digimon} />

        <Collapse id="stats" title="Stats" defaultOpen>
          <StatBars digimon={digimon} />
        </Collapse>
        <Collapse id="resistances" title="Resistances">
          <ResistanceGrid digimon={digimon} />
        </Collapse>
        <Collapse id="skills" title="Skills">
          <SkillList digimon={digimon} />
        </Collapse>
        <Collapse id="personalities" title="Conversion personalities">
          <PersonalityTable digimon={digimon} />
        </Collapse>
        {digimon.postEvolutionDialogue && (
          <Collapse id="dialogue" title="Post-evolution dialogue">
            <DialogueBlock lines={digimon.postEvolutionDialogue} name={digimon.name} />
          </Collapse>
        )}
        <div className={styles.traits}>Traits: {digimon.traits.join(', ') || '—'}</div>
      </div>
    </Panel>
  );
}
