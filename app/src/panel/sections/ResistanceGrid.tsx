import { ATTRIBUTE_KEYS, ELEMENT_KEYS, type Digimon, type ResistanceMultiplier } from '../../data/schema';
import styles from './ResistanceGrid.module.css';

function cellClass(multiplier: ResistanceMultiplier): string {
  if (multiplier === 0) return styles.immune;
  if (multiplier === 0.5) return styles.resist;
  if (multiplier === 1) return styles.neutral;
  return styles.weak;
}

// Marker + number + colour: three redundant channels so resistance never rides
// on colour alone.
function label(multiplier: ResistanceMultiplier): string {
  if (multiplier === 0) return '⊘ IMM';
  if (multiplier < 1) return `▼ ×${multiplier}`; // resists
  if (multiplier > 1) return `▲ ×${multiplier}`; // weak to
  return `×${multiplier}`;
}

export function ResistanceGrid({ digimon }: { digimon: Digimon }) {
  return (
    <div className={styles.wrap}>
      <div className="label">Attribute</div>
      <div className={styles.grid}>
        {ATTRIBUTE_KEYS.map((key) => (
          <div key={key} className={`${styles.cell} ${cellClass(digimon.attributeResistances[key])}`}>
            <span className={styles.key}>{key}</span>
            <span>{label(digimon.attributeResistances[key])}</span>
          </div>
        ))}
      </div>
      <div className="label">Elemental</div>
      <div className={styles.grid}>
        {ELEMENT_KEYS.map((key) => (
          <div key={key} className={`${styles.cell} ${cellClass(digimon.elementalResistances[key])}`}>
            <span className={styles.key}>{key}</span>
            <span>{label(digimon.elementalResistances[key])}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
