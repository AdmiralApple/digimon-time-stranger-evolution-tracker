# CLAUDE.md

## Design Context

This project has captured design context. Read these before UI work:

- **[PRODUCT.md](PRODUCT.md)** — strategic: register (product), platform (web), users (planners/completionists; secondary: casual mid-game lookups), purpose, positioning, brand personality, anti-references, design principles, accessibility (WCAG 2.2 AA + reduced motion + non-color cues).
- **[DESIGN.md](DESIGN.md)** — visual system: the "Chromatic Instrument" — a quiet graphite chrome whose single accent is repainted with the *selected* Digimon's own hue. OKLCH tokens, Hanken Grotesk (data/UI) + Chakra Petch (wordmark only), tactile components, flat-by-default elevation. Machine-readable tokens live in its YAML frontmatter; extensions (tonal ramps, shadows, motion, component snippets) in `.impeccable/design.json`.

The one line: **color comes from the Digimon, not the chrome.** Never hard-code a brand hue where `--accent` belongs, and never let color be the sole channel — always pair it with a name, glyph, or shape.

For design tasks, the `/impeccable` skill reads both files automatically.
