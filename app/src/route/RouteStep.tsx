import { appData } from '../data/appData';
import type { RouteStep } from '../data/route';
import { reduceStat, stacksForPersonality } from '../data/agentSkills';
import { useStore } from '../state/store';
import { Chip } from '../ui/Chip';
import { MonRow } from '../ui/MonRow';
import { ReductionNote } from '../ui/ReductionNote';
import { StatReqChip } from '../ui/StatReqChip';
import styles from './RouteStep.module.css';

interface RouteStepCardProps {
  step: RouteStep;
  index: number;
  active: boolean;
  onHover: (hovering: boolean) => void;
}

export function RouteStepCard({ step, index, active, onHover }: RouteStepCardProps) {
  const select = useStore((s) => s.select);
  const agentSkills = useStore((s) => s.agentSkills);
  const db = appData().db;
  const from = db.digimon[step.from];
  const to = db.digimon[step.to];
  const isEvolve = step.kind === 'digivolve';
  const requirement = step.requirement;
  const persona = to.basePersonality;
  const stacks = stacksForPersonality(persona, agentSkills);
  const showReduction =
    isEvolve && stacks > 0 && !!requirement && Object.keys(requirement.stats).length > 0;

  return (
    <div
      className={`${styles.card} ${active ? styles.active : ''} ${isEvolve ? styles.evolve : styles.devolve}`}
      tabIndex={0}
      aria-label={`Step ${index + 1}: ${isEvolve ? 'Digivolve' : 'De-Digivolve'} ${from.name} to ${to.name}`}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
    >
      <div className={`label ${styles.kind}`}>
        {index + 1}. {isEvolve ? '▲ Digivolve' : '▼ De-Digivolve'}
      </div>
      <div className={styles.pair}>
        <MonRow inline slug={step.from} name={from.name} size={30} onClick={() => select(step.from)} />
        <span className={styles.arrow}>→</span>
        <MonRow inline slug={step.to} name={to.name} size={30} onClick={() => select(step.to)} />
      </div>

      {/* Base personality leads every step: it's load-bearing when planning
          digivolutions, and it's one of the two ways a de-digivolution unlocks
          (see the note below). */}
      <div className={styles.pills}>
        <span className={styles.persona} title={`${to.name}'s base personality: ${persona}`}>
          <span className={styles.personaKey}>Personality</span>
          {persona}
        </span>
        {isEvolve && requirement && (
          <>
            <Chip>Rank ≥ {requirement.agentRank}</Chip>
            {Object.entries(requirement.stats).map(([stat, value]) => (
              <StatReqChip key={stat} label={stat} base={value!} reduced={reduceStat(value!, stacks)} />
            ))}
            {requirement.talent !== undefined && <Chip>Talent ≥ {requirement.talent}</Chip>}
            {requirement.item && (
              <Chip color="var(--item)">◆ {requirement.item}</Chip>
            )}
            {requirement.partners?.map((partner) => (
              <Chip
                key={partner.slug}
                color="var(--jogress)"
                title="Must also be raised — not part of this route"
                onClick={() => select(partner.slug)}
              >
                ⧉ {partner.name} ({partner.personality})
              </Chip>
            ))}
            {requirement.agentSkills?.map((skill) => (
              <Chip key={skill.category} color="var(--bond)">
                ❖ {skill.category} {skill.value}
              </Chip>
            ))}
          </>
        )}
      </div>

      {showReduction && <ReductionNote stacks={stacks} personality={persona} />}

      {!isEvolve && (
        <p className={styles.note}>
          Available once you’ve met {to.name} — or if your Digimon’s personality is {persona}.
        </p>
      )}
    </div>
  );
}
