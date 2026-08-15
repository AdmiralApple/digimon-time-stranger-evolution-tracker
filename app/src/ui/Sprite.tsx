import { ATLAS_BG_HEIGHT, ATLAS_BG_WIDTH, ATLAS_SRC, atlasPosition, hasAtlasCell } from '../data/atlas';
import styles from './Sprite.module.css';

/**
 * A Digimon thumbnail — one place for how sprites resolve and render app-wide.
 * Every sprite is a window onto the shared atlas sheet (one request for all of
 * them), positioned to its tile. Decorative, so it's hidden from assistive tech.
 * Pass a `className` to add context-specific styling (e.g. a placeholder bg).
 */
export function Sprite({
  slug,
  size = 28,
  className,
}: {
  slug: string;
  size?: number;
  className?: string;
}) {
  const has = hasAtlasCell(slug);
  return (
    <span
      className={className ? `${styles.sprite} ${className}` : styles.sprite}
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        backgroundImage: has ? `url("${ATLAS_SRC}")` : undefined,
        backgroundSize: `${ATLAS_BG_WIDTH} ${ATLAS_BG_HEIGHT}`,
        backgroundPosition: atlasPosition(slug),
      }}
    />
  );
}
