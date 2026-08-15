import type { DialogueLine } from '../../data/schema';
import styles from './DialogueBlock.module.css';

export function DialogueBlock({ lines, name }: { lines: DialogueLine[]; name: string }) {
  return (
    <div className={styles.wrap}>
      {lines.map((line, i) => (
        <div
          key={i}
          className={line.speaker === 'digimon' ? styles.digimon : styles.player}
        >
          <span className={`label ${styles.speaker}`}>
            {line.speaker === 'digimon' ? name : 'You'}
          </span>
          {line.text}
        </div>
      ))}
    </div>
  );
}
