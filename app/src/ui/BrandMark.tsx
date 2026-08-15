import styles from './BrandMark.module.css';

/** The wordmark glyph — a branching lineage (small form → larger form). Inherits
 *  `currentColor`, so it takes on the chromatic accent wherever it's placed.
 *  Pass `animated` (splash only) to play the one-shot "evolution" sequence. */
export function BrandMark({ size = 22, animated = false }: { size?: number; animated?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
      className={animated ? styles.animated : undefined}
    >
      <path
        className={animated ? styles.link : undefined}
        d="M31 64 L60 38"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <circle className={animated ? styles.small : undefined} cx="31" cy="64" r="11" fill="currentColor" />
      <circle className={animated ? styles.big : undefined} cx="63" cy="34" r="15.5" fill="currentColor" />
    </svg>
  );
}
