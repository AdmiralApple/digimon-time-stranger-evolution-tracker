import { useCallback, useRef, useState } from 'react';
import { SAVE_FILE_ACCEPT, SAVE_FILE_EXAMPLE, SAVE_PATH } from '../discovery/saveMeta';
import { appData } from '../data/appData';
import { useStore } from '../state/store';
import { BrandMark } from '../ui/BrandMark';
import { rememberFirstRunChoice } from './browserState';
import styles from './FirstRun.module.css';

function SaveIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M5 3.75h11.5L20.25 7.5v12.75H3.75V3.75H5Z" />
      <path d="M7.25 3.75v6h9.5v-6M8 20.25v-6.5h8v6.5" />
    </svg>
  );
}

function AtlasIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" />
      <circle cx="12" cy="12" r="2.25" />
      <path d="M12 3.75v3M12 17.25v3M3.75 12h3M17.25 12h3" />
    </svg>
  );
}

export function FirstRun({ onComplete }: { onComplete: () => void }) {
  const importSave = useStore((state) => state.importSave);
  const setDiscoveryMode = useStore((state) => state.setDiscoveryMode);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = appData().graph.slugs.length;

  const revealAll = useCallback(() => {
    setDiscoveryMode(false);
    rememberFirstRunChoice('all');
    onComplete();
  }, [onComplete, setDiscoveryMode]);

  const onFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;

      setBusy(true);
      setError(null);
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        importSave(bytes);
        rememberFirstRunChoice('save');
        onComplete();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason));
      } finally {
        setBusy(false);
      }
    },
    [importSave, onComplete],
  );

  return (
    <main className={styles.screen}>
      <section
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-run-title"
        aria-describedby="first-run-copy"
      >
        <header className={styles.header}>
          <span className={styles.mark}><BrandMark size={42} animated /></span>
          <div>
            <h1 id="first-run-title">How should the atlas begin?</h1>
          </div>
        </header>

        <p id="first-run-copy" className={styles.intro}>
          The evolution tree is hidden until you choose. Load your game progress to reveal only
          Digimon you&rsquo;ve encountered, or open the complete atlas now.
        </p>

        <div className={styles.choices}>
          <article className={`${styles.choice} ${styles.choicePrimary}`}>
            <span className={styles.icon}><SaveIcon /></span>
            <div className={styles.choiceCopy}>
              <span className={styles.recommended}>Recommended</span>
              <h2>Continue from my save</h2>
              <p>Start spoiler-free with your discovered and registered Digimon.</p>
            </div>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => fileRef.current?.click()}
              disabled={busy}
            >
              {busy ? 'Reading save…' : 'Choose save file'}
            </button>
            <input
              ref={fileRef}
              className={styles.file}
              type="file"
              accept={SAVE_FILE_ACCEPT}
              onChange={onFile}
            />
            <span className={styles.path}>
              For Steam: {SAVE_PATH}
              <br />
              Example: {SAVE_FILE_EXAMPLE}
            </span>
          </article>

          <article className={styles.choice}>
            <span className={styles.icon}><AtlasIcon /></span>
            <div className={styles.choiceCopy}>
              <span className={styles.revealLabel}>Contains spoilers</span>
              <h2>Show the full atlas</h2>
              <p>Reveal all {total} Digimon and every known evolution connection.</p>
            </div>
            <button type="button" className={styles.secondaryButton} onClick={revealAll}>
              Show everything
            </button>
          </article>
        </div>

        {error && <p className={styles.error} role="alert">Couldn&rsquo;t read that save: {error}</p>}

        <footer className={styles.footer}>
          Your save is read on this device and is never uploaded. You can change spoiler settings
          later from Game progress.
        </footer>
      </section>
    </main>
  );
}
