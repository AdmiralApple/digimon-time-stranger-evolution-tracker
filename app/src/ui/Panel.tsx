import type { ReactNode } from 'react';
import styles from './Panel.module.css';

/** The right-hand side panel shell (detail view, route planner). */
export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <aside className={`${styles.panel} ${className ?? ''}`}>{children}</aside>;
}

/** Standard ✕ dismiss button used in panel headers. */
export function CloseButton({
  onClick,
  title = 'Close',
}: {
  onClick: () => void;
  title?: string;
}) {
  return (
    <button className={styles.close} onClick={onClick} title={title} aria-label={title}>
      ✕
    </button>
  );
}
