import { useStore } from '../state/store';
import { CloseButton, Panel } from '../ui/Panel';
import styles from './FrontierPanel.module.css';

/** Anonymous detail surface for a one-hop frontier silhouette. Its slug stays
 * internal until the player explicitly reveals the form. */
export function FrontierPanel({ slug }: { slug: string }) {
  const reveal = useStore((state) => state.reveal);
  const select = useStore((state) => state.select);
  const selectFrontier = useStore((state) => state.selectFrontier);

  const onReveal = () => {
    reveal(slug);
    select(slug);
  };

  return (
    <Panel className={styles.panel}>
      <header className={styles.header}>
        <span className={styles.unknown} aria-hidden="true">?</span>
        <div className={styles.titleBlock}>
          <span className={styles.recordLabel}>Frontier hint</span>
          <h2>Unknown Digimon</h2>
        </div>
        <CloseButton onClick={() => selectFrontier(null)} title="Close (Esc)" />
      </header>

      <div className={styles.body}>
        <div className={styles.signal} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <h3>A new path is within reach.</h3>
        <p>
          This silhouette is directly connected to a Digimon already in your atlas.
          Reveal it to continue exploring from here.
        </p>
        <button type="button" className={styles.reveal} onClick={onReveal}>
          <span>Click to reveal</span>
          <span aria-hidden="true">→</span>
        </button>
        <p className={styles.note}>
          Added to this browser&rsquo;s atlas progress. You won&rsquo;t need to upload your save again.
        </p>
      </div>
    </Panel>
  );
}
