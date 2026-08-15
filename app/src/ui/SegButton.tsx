import type { ReactNode } from 'react';
import styles from './SegButton.module.css';

interface SegButtonProps {
  children: ReactNode;
  /** Renders the accent (selected) state. */
  active?: boolean;
  /** `md` for the top bar, `sm` for the denser detail-panel actions. */
  size?: 'sm' | 'md';
  title?: string;
  onClick?: () => void;
}

/**
 * A small segmented toggle button (font-display, accent hover/active).
 * The app's standard toolbar / action affordance.
 */
export function SegButton({ children, active, size = 'md', title, onClick }: SegButtonProps) {
  return (
    <button
      className={`${styles.btn} ${styles[size]} ${active ? styles.active : ''}`}
      onClick={onClick}
      title={title}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}
