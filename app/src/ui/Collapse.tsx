import { useState, type ReactNode } from 'react';
import styles from './Collapse.module.css';

interface CollapseProps {
  id: string; // localStorage key suffix
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

const storageKey = (id: string) => `tst.collapse.${id}`;

export function Collapse({ id, title, defaultOpen = false, children }: CollapseProps) {
  const [open, setOpen] = useState<boolean>(() => {
    // Runs during render — guard storage access so a blocked-storage context
    // (private mode / sandboxed iframe) doesn't throw out of render and crash
    // the detail panel every time a Digimon is opened.
    try {
      const stored = localStorage.getItem(storageKey(id));
      return stored === null ? defaultOpen : stored === '1';
    } catch {
      return defaultOpen;
    }
  });

  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(storageKey(id), next ? '1' : '0');
    } catch {
      /* storage blocked — the section's open state just won't persist */
    }
  };

  return (
    <section className={styles.section}>
      <button className={styles.header} onClick={toggle} aria-expanded={open}>
        <span className={`${styles.arrow} ${open ? styles.arrowOpen : ''}`}>▸</span>
        {title}
      </button>
      {open && <div className={styles.body}>{children}</div>}
    </section>
  );
}
