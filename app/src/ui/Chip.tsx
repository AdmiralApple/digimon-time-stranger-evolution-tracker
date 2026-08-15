import type { CSSProperties, ReactNode } from 'react';
import styles from './Chip.module.css';

interface ChipProps {
  children: ReactNode;
  color?: string;
  title?: string;
  onClick?: () => void;
}

export function Chip({ children, color, title, onClick }: ChipProps) {
  const style = color ? ({ '--chip-color': color } as CSSProperties) : undefined;
  const className = [styles.chip, color ? styles.tinted : '', onClick ? styles.clickable : '']
    .filter(Boolean)
    .join(' ');
  if (onClick) {
    return (
      <button className={className} style={style} title={title} onClick={onClick}>
        {children}
      </button>
    );
  }
  return (
    <span className={className} style={style} title={title}>
      {children}
    </span>
  );
}
