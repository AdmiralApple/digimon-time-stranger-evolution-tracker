import { appData } from '../data/appData';
import { useStore } from '../state/store';
import { Panel } from '../ui/Panel';
import { Sprite } from '../ui/Sprite';
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

const STEPS = [
  ['01', 'Choose a form', 'Search by name, number, or pick a familiar partner.'],
  ['02', 'Isolate its lineage', 'Strip away the noise and see every form it connects to.'],
  ['03', 'Build a route', 'Set a start and goal to compare the best evolution paths.'],
];

export function EmptyPanel() {
  const select = useStore((s) => s.select);
  const openRoute = useStore((s) => s.openRoute);
  const db = appData().db;
  const featured = FEATURED.filter((slug) => db.digimon[slug]).slice(0, 6);

  const focusSearch = () => {
    const input = document.getElementById('digimon-search');
    if (input instanceof HTMLInputElement) {
      input.focus();
      input.select();
    }
  };

  const surprise = () => {
    const slugs = appData().graph.slugs;
    select(slugs[Math.floor(Math.random() * slugs.length)]);
  };

  return (
    <Panel className={styles.panel}>
      <div className={styles.scroll}>
        <div className={styles.intro}>
          <span className={styles.kicker}>Evolution atlas · 475 known forms</span>
          <h2 className={styles.heading}>
            Pick a Digimon.
            <span> See every way forward.</span>
          </h2>
          <p className={styles.lede}>
            Pick any Digimon to reveal its requirements, connected forms, and the routes
            that can take you there.
          </p>
          <div className={styles.heroActions}>
            <button className={styles.primary} onClick={focusSearch}>
              Find a Digimon <kbd>/</kbd>
            </button>
            <button className={styles.secondary} onClick={() => openRoute()}>
              Plan an evolution <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>

        <ol className={styles.workflow} aria-label="How to use the evolution map">
          {STEPS.map(([number, title, body]) => (
            <li key={number} className={styles.step}>
              <span className={styles.stepNumber}>{number}</span>
              <span className={styles.stepCopy}>
                <strong>{title}</strong>
                <span>{body}</span>
              </span>
            </li>
          ))}
        </ol>

        {featured.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <span className="label">Try a partner</span>
              <button type="button" className={styles.random} onClick={surprise}>
                Random pick
              </button>
            </div>
            <div className={styles.featured}>
              {featured.map((slug) => {
                const digimon = db.digimon[slug];
                return (
                  <button key={slug} className={styles.partner} onClick={() => select(slug)}>
                    <Sprite slug={slug} size={44} className={styles.partnerSprite} />
                    <span className={styles.partnerCopy}>
                      <strong>{digimon.name}</strong>
                      <span>{digimon.generation}</span>
                    </span>
                    <span className={styles.partnerArrow} aria-hidden="true">
                      →
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <p className={styles.shortcut}>
          Double-click a Digimon to isolate its lineage. Press <kbd>F</kbd> to toggle it.
        </p>
      </div>
    </Panel>
  );
}
