import type { AttachmentSkill, Digimon, Skill } from '../../data/schema';
import { classifyAttackType } from '../../data/skills';
import styles from './SkillList.module.css';

function SkillRow({ skill, level }: { skill: Skill; level?: number }) {
  const attackType = classifyAttackType(skill.description);
  return (
    <div className={styles.skill}>
      <div className={styles.head}>
        <span className={styles.name}>{skill.name}</span>
        {skill.element && <span className={styles.element}>{skill.element}</span>}
        {attackType && <span className={styles.type}>{attackType}</span>}
        {level !== undefined && <span className={styles.level}>Lv. {level}</span>}
      </div>
      <div className={styles.numbers}>
        SP {skill.spCost} · Pow {skill.power} · Acc {skill.accuracy}% · Crit {skill.critRate}%
      </div>
      <div className={styles.desc}>{skill.description}</div>
    </div>
  );
}

export function SkillList({ digimon }: { digimon: Digimon }) {
  return (
    <div className={styles.wrap}>
      {digimon.specialSkills.length > 0 && (
        <>
          <div className={`label ${styles.groupLabel}`}>Special skills</div>
          {digimon.specialSkills.map((skill) => (
            <SkillRow key={skill.slug} skill={skill} />
          ))}
        </>
      )}
      {digimon.attachmentSkills.length > 0 && (
        <>
          <div className={`label ${styles.groupLabel}`}>Attachment skills</div>
          {digimon.attachmentSkills.map((skill: AttachmentSkill) => (
            <SkillRow key={skill.slug} skill={skill} level={skill.level} />
          ))}
        </>
      )}
    </div>
  );
}
