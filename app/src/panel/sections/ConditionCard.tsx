import type { EvolutionCondition, Personality } from '../../data/schema';
import { reduceStat, stacksForPersonality } from '../../data/agentSkills';
import { useStore } from '../../state/store';
import { Chip } from '../../ui/Chip';
import { InfoTip } from '../../ui/InfoTip';
import { MonRow } from '../../ui/MonRow';
import { ReductionNote } from '../../ui/ReductionNote';
import { StatReqChip } from '../../ui/StatReqChip';
import styles from './ConditionCard.module.css';

interface ConditionCardProps {
  condition: EvolutionCondition;
  basePersonality: Personality;
}

/** "How to obtain" — the requirements to evolve INTO the shown Digimon. */
export function ConditionCard({ condition, basePersonality }: ConditionCardProps) {
  const select = useStore((s) => s.select);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const agentSkills = useStore((s) => s.agentSkills);
  const stacks = stacksForPersonality(basePersonality, agentSkills);
  const statEntries = Object.entries(condition.stats ?? {});
  const showReduction = stacks > 0 && statEntries.length > 0;
  // Agent rank is on effectively every evolution, so it gets a fixed home on the
  // title row; the pill row is left for the requirements that actually vary
  // (stats, talent, bond, item) and is skipped entirely when there are none.
  const hasPills =
    statEntries.length > 0 ||
    condition.talent != null ||
    (condition.agentSkills?.length ?? 0) > 0 ||
    condition.requiredItem != null;

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <span className={`label ${styles.title}`}>How to obtain</span>
        <Chip title="Minimum Agent rank">Rank ≥ {condition.agentRank.value}</Chip>
      </div>
      {hasPills && (
        <div className={styles.pills}>
          {statEntries.map(([stat, threshold]) => (
            <StatReqChip
              key={stat}
              label={stat}
              base={threshold!.value}
              reduced={reduceStat(threshold!.value, stacks)}
            />
          ))}
          {condition.talent && <Chip>Talent ≥ {condition.talent.value}</Chip>}
          {condition.agentSkills?.map((skill) => (
            <Chip key={skill.category} color="var(--bond)" title="Agent Skills requirement">
              {skill.category} {skill.value}
            </Chip>
          ))}
          {condition.requiredItem && (
            <Chip color="var(--item)" title="Required item">
              ◆ {condition.requiredItem}
            </Chip>
          )}
        </div>
      )}
      {showReduction && <ReductionNote stacks={stacks} personality={basePersonality} />}
      {condition.jogressPartners && (
        <div className={styles.partners}>
          <div className={`label ${styles.partnerLabel}`}>Jogress/DNA with</div>
          {condition.jogressPartners.map((partner) => (
            <MonRow
              key={partner.slug}
              slug={partner.slug}
              name={partner.name}
              meta={partner.personality}
              borderColor="var(--jogress)"
              onClick={() => select(partner.slug)}
              title={`${partner.name} — must also be raised`}
            />
          ))}
        </div>
      )}
      <div className={styles.persona}>
        <span className={`label ${styles.personaLabel}`}>Base personality</span>
        <Chip color="var(--accent)">{basePersonality}</Chip>
        <InfoTip
          label="How base personality affects the requirements"
          action={{ label: 'Open settings', onClick: () => setSettingsOpen(true) }}
        >
          <p>
            When the source Digimon’s personality matches this base personality and you have the
            matching Agent Skills, the stat requirements are reduced.
          </p>
          <p>
            Set how many “Digivolution” Agent Skills you own to preview the reduced stats here.
          </p>
        </InfoTip>
      </div>
      <div className={styles.caption}>
        Requirements to evolve into this Digimon, from any pre-evolution.
      </div>
    </div>
  );
}
