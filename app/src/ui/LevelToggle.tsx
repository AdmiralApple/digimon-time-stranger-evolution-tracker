import type { StatLevel } from '../data/schema';
import styles from './LevelToggle.module.css';

/** Lv.1 ⇄ Lv.99 pill toggle — shared by the detail-panel StatBars and the Codex. */
export function LevelToggle({
  value,
  onChange,
  className,
}: {
  value: StatLevel;
  onChange: (level: StatLevel) => void;
  className?: string;
}) {
  return (
    <div
      className={className ? `${styles.toggle} ${className}` : styles.toggle}
      role="group"
      aria-label="Stat level"
    >
      <button
        type="button"
        className={value === 'lv1' ? styles.active : styles.btn}
        aria-pressed={value === 'lv1'}
        onClick={() => onChange('lv1')}
      >
        Lv. 1
      </button>
      <button
        type="button"
        className={value === 'lv99' ? styles.active : styles.btn}
        aria-pressed={value === 'lv99'}
        onClick={() => onChange('lv99')}
      >
        Lv. 99
      </button>
    </div>
  );
}
