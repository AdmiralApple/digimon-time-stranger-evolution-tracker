import { appData } from '../data/appData';
import { useStore } from '../state/store';
import { MonRow } from '../ui/MonRow';
import { Panel } from '../ui/Panel';
import styles from './EmptyPanel.module.css';

// Well-known partners as a warm entry point — filtered to whatever the dataset
// actually ships.
const FEATURED = [
  'agumon',
  'gabumon',
  'guilmon',
  'veemon',
  'renamon',
  'patamon',
  'gomamon',
  'palmon',
  'biyomon',
  'tentomon',
  'gatomon',
  'impmon',
];

const KEYS: Array<[string, string]> = [
  ['/  ·  Ctrl K', 'Search'],
  ['Click', 'Details'],
  ['Double-click  ·  F', 'Focus a full lineage'],
  ['◈', 'Focused lineage'],
  ['⧉', 'Jogress/DNA fusion'],
  ['◆', 'Item-gated evolution'],
  ['❖', 'Bond form'],
];

export function EmptyPanel() {
  const select = useStore((s) => s.select);
  const db = appData().db;
  const featured = FEATURED.filter((slug) => db.digimon[slug]).slice(0, 6);

  const surprise = () => {
    const slugs = appData().graph.slugs;
    select(slugs[Math.floor(Math.random() * slugs.length)]);
  };

  return (
    <Panel className={styles.panel}>
      <div className={styles.scroll}>
        <div className={styles.intro}>
          <h2 className={styles.heading}>Explore the Digital World</h2>
          <p className={styles.lede}>
            Every Digimon in <em>Time Stranger</em> and how it evolves. Pick one to see its
            stats, resistances, and full lineage — or plan a route between any two forms.
          </p>
          <button className={styles.surprise} onClick={surprise}>
            <span className={styles.sparkle}>✦</span> Surprise me
          </button>
        </div>

        {featured.length > 0 && (
          <div className={styles.section}>
            <div className="label">Start with a partner</div>
            <div className={styles.featured}>
              {featured.map((slug) => (
                <MonRow
                  key={slug}
                  slug={slug}
                  meta={db.digimon[slug].generation}
                  onClick={() => select(slug)}
                />
              ))}
            </div>
          </div>
        )}

        <div className={styles.section}>
          <div className="label">Getting around</div>
          <dl className={styles.keys}>
            {KEYS.map(([k, v]) => (
              <div key={v} className={styles.keyRow}>
                <dt className={styles.key}>{k}</dt>
                <dd className={styles.keyDesc}>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </Panel>
  );
}
