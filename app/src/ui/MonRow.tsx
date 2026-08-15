import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { appData } from '../data/appData';
import { Sprite } from './Sprite';
import styles from './MonRow.module.css';

interface MonRowProps {
  /** Digimon slug — drives the sprite and the default label. */
  slug: string;
  /** Label override; defaults to the Digimon's name from the database. */
  name?: ReactNode;
  /** Secondary line beneath the name (e.g. an evolution condition summary). */
  sub?: ReactNode;
  /** Trailing content, right-aligned (generation, condition summary, personality…). */
  meta?: ReactNode;
  /** Sprite size in px. Default 28. */
  size?: number;
  /** Selection / keyboard highlight — renders the hover background persistently. */
  active?: boolean;
  /** Inline (auto-width) layout for use inside a flex row, e.g. an A → B pair. */
  inline?: boolean;
  /** Bordered variant tinted with this colour (e.g. jogress partners). */
  borderColor?: string;
  title?: string;
  className?: string;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseDown?: (event: MouseEvent) => void;
}

/**
 * A clickable Digimon sprite + name, the app's canonical "pick a Digimon" row.
 * Presentational only — pass an `onClick` (usually `() => select(slug)`).
 */
export function MonRow({
  slug,
  name,
  sub,
  meta,
  size = 28,
  active,
  inline,
  borderColor,
  title,
  className,
  onClick,
  onMouseEnter,
  onMouseDown,
}: MonRowProps) {
  const label = name ?? appData().db.digimon[slug]?.name ?? slug;
  const classes = [
    styles.row,
    inline ? styles.inline : '',
    active ? styles.active : '',
    borderColor ? styles.bordered : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  const style: CSSProperties | undefined = borderColor
    ? { borderColor }
    : undefined;

  return (
    <button
      className={classes}
      style={style}
      title={title}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseDown={onMouseDown}
    >
      <Sprite slug={slug} size={size} />
      {sub != null ? (
        <span className={styles.body}>
          <span className={styles.name}>{label}</span>
          <span className={styles.sub}>{sub}</span>
        </span>
      ) : (
        <span className={styles.name}>{label}</span>
      )}
      {meta != null && <span className={styles.meta}>{meta}</span>}
    </button>
  );
}
