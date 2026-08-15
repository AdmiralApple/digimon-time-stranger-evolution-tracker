import type { Digimon, Personality } from '../../data/schema';
import styles from './PersonalityTable.module.css';

export function PersonalityTable({ digimon }: { digimon: Digimon }) {
  const rows = (Object.entries(digimon.conversionPersonalities) as [Personality, number][])
    .filter(([, pct]) => pct > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <div className={styles.caption}>Possible personalities upon conversion.</div>
      {rows.map(([personality, pct]) => (
        <div key={personality} className={styles.row}>
          <span>{personality}</span>
          <div className={styles.track}>
            <div className={styles.bar} style={{ width: `${pct}%` }} />
          </div>
          <span className={styles.pct}>{pct.toFixed(2)}%</span>
        </div>
      ))}
    </div>
  );
}
