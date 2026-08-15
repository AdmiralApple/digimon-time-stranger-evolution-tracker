---
name: Time Stranger Tree
description: The Chromatic Instrument — a quiet graphite tool that recolors itself to the Digimon in focus.
colors:
  accent: "oklch(0.8 0.12 72)"
  accent-ink: "oklch(0.2 0.03 72)"
  accent-soft: "oklch(0.8 0.12 72 / 0.16)"
  bg: "oklch(0.16 0.006 66)"
  surface: "oklch(0.205 0.007 66)"
  surface-2: "oklch(0.255 0.008 66)"
  border: "oklch(0.32 0.009 66)"
  border-strong: "oklch(0.4 0.011 66)"
  text: "oklch(0.95 0.004 75)"
  text-dim: "oklch(0.745 0.008 72)"
  text-mute: "oklch(0.64 0.008 72)"
  graph-bg: "oklch(0.145 0.008 66)"
  danger: "oklch(0.68 0.19 25)"
  resist: "oklch(0.72 0.15 150)"
  item: "oklch(0.76 0.16 58)"
  jogress: "oklch(0.66 0.19 305)"
  bond: "oklch(0.74 0.11 215)"
  attr-vaccine: "#3496ef"
  attr-data: "#4cb86a"
  attr-virus: "#ac5cd7"
  attr-free: "#d7ab28"
  attr-variable: "#ee5b9a"
  attr-unknown: "#8594a4"
  attr-no-data: "#65707b"
typography:
  brand:
    fontFamily: "Chakra Petch, Hanken Grotesk, system-ui, sans-serif"
    fontWeight: 700
    letterSpacing: "-0.01em"
  heading:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontWeight: 700
    letterSpacing: "-0.01em"
    lineHeight: 1.2
  body:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.6px"
rounded:
  xs: "4px"
  sm: "7px"
  md: "10px"
  lg: "14px"
  pill: "999px"
components:
  seg-button:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "5px 12px"
  seg-button-active:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
  filter-chip:
    backgroundColor: "transparent"
    textColor: "{colors.text-dim}"
    rounded: "{rounded.pill}"
    padding: "3px 10px"
  filter-chip-active:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
  input:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  stepper:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "2px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    width: "384px"
---

# Design System: Time Stranger Tree

## 1. Overview

**Creative North Star: "The Chromatic Instrument"**

Time Stranger Tree is a precise, quiet instrument that borrows all of its color from the Digimon in focus. The housing is a warm graphite stage at near-zero chroma; the single accent is repainted, live, with the *selected* sprite's own signature hue, so the whole interface morphs as you move through the network. The feeling is a capable field tool with a light sci-fi charge — Digivice / terminal energy, without ever cosplaying it. Nothing decorative competes with the creatures; the chrome recedes so the subject can lead.

It is tactile and confident in the hand: controls sit on solid graphite fills, the active state is a wash of the live accent, and interactions answer back (a press scales the control, the accent ramp *sweeps* to a new hue rather than cutting). Density is high and unafraid — a 475-row field guide, a full evolution graph, panels dense with requirement chips — because the users are planners who want the data, not a landing page. Motion is reserved for meaning: state, feedback, and the one signature flourish (the chromatic morph).

This system explicitly rejects the generic AI-slop SaaS look (cream backgrounds, gradient text, identical icon-card grids, tracked-uppercase eyebrows over every section, the hero-metric template), the cluttered ad-heavy fan-wiki, and the bare spreadsheet dump. It is none of those: it is an instrument with an identity that comes from its subject.

**Key Characteristics:**
- Borrowed color: one dynamic accent, taken from the selected Digimon's sprite; the graphite chrome never competes.
- Dual-theme, single system: a night viewport and a daylight-parchment viewport, same tokens, accent legible in both.
- Dense but hierarchical: lots of data, ordered by weight and spacing, never a flat grid.
- Tactile & confident: solid fills, accent-soft active states, press feedback, a brisk chromatic morph.
- Color is never the only channel: names, markers, and shapes always carry the same meaning.

Spacing is an informal 8px-based rhythm (common steps 4 / 5 / 6 / 8 / 10 / 12 / 16px); there is no named spacing token, and none should be invented. The z-index scale is semantic and tokenized (`--z-overlay` 10 → `--z-toolbar` 15 → `--z-topbar` 20 → `--z-panel` 40 → `--z-view` 45 → `--z-dropdown` 100); never write an arbitrary z value.

## 2. Colors

A warm graphite stage at near-zero chroma, lit by one borrowed accent, with a small vocabulary of domain hues and a seven-color attribute data palette.

### Primary
- **Borrowed Accent** (`oklch(var(--accent-l) var(--accent-c) var(--accent-h))`; default temporal amber `oklch(0.8 0.12 72)`): the single accent. Hue and chroma are repainted per selection from the sprite's dominant color (`chroma.ts`); the theme owns lightness (`--accent-l` 0.8 dark / 0.56 light) so it reads in both. Used for primary actions, current selection, focus rings, active filters, the live checkbox fill, and the graph's selection glow — never as blanket decoration. Derived roles: `--accent-soft` (16% fill for active states), `--accent-faint` (9% hover wash), `--accent-ink` (text on an accent fill), `--accent-line` (55% hairlines).

### Secondary
Domain accents — each names a mechanic and is always paired with a glyph, so the hue is a reinforcement, not the message:
- **Item** (`oklch(0.76 0.16 58)`, ◆): item-gated evolutions.
- **Jogress/DNA** (`oklch(0.66 0.19 305)`, ⧉): fusion evolutions and their partners.
- **Bond** (`oklch(0.74 0.11 215)`, ❖): Agent-Skill / Bond forms, and the **Agent-Skill stat-requirement reductions** — the reduced requirement chips, the Settings stack readout, and the evolves-to reduction marker all wear this hue + ❖.
- **Resist** (`oklch(0.72 0.15 150)`, ▼) and **Danger** (`oklch(0.68 0.19 25)`, ▲): resistance / weakness in the field guide and detail panel.

### Tertiary
The **attribute data palette** — seven categorical colors tuned in OKLCH for mutual separation, always backed by a legend name and a shape badge in the graph: Vaccine `#3496ef`, Data `#4cb86a`, Virus `#ac5cd7`, Free `#d7ab28`, Variable `#ee5b9a`, Unknown `#8594a4`, No Data `#65707b`. These live in `src/theme/attribute.ts` (Cytoscape can't read CSS vars) and are injected as `--attr-*` on boot.

### Neutral
A warm graphite ramp (dark, default), each step one surface layer; depth is built by stacking these, not by shadow:
- **bg** (`oklch(0.16 0.006 66)`): app background.
- **surface** (`oklch(0.205 0.007 66)`): panels, dropdowns.
- **surface-2** (`oklch(0.255 0.008 66)`): controls, chips, inputs, cards.
- **border** (`oklch(0.32 0.009 66)`) / **border-strong** (`oklch(0.4 0.011 66)`): hairlines and hover borders.
- **text** (`oklch(0.95 0.004 75)`) / **text-dim** (`oklch(0.745 0.008 72)`) / **text-mute** (`oklch(0.64 0.008 72)`): primary / secondary / tertiary type. All three clear WCAG AA (≥4.5:1) for small text on every surface in both themes; `text-mute` is tuned to the AA floor so even the 9px muted labels stay legible.
- **graph-bg** (`oklch(0.145 0.008 66)`): the near-black "Digital World" viewport, deliberately darker than `bg` so sprites and their glow lead.

The light theme (`:root[data-theme='light']`) is the same system in daylight: `bg` `oklch(0.955 0.003 85)`, `surface` `oklch(0.995 0.001 85)`, `text` `oklch(0.26 0.012 55)`, and a warm-parchment graph viewport (`oklch(0.925 0.012 85)`) — never clinical white, which blows out the sprites. The graph has its own concrete palette per theme in `GRAPH_PALETTES`; keep `--graph-bg` in step with it.

**The Borrowed Color Rule.** The accent is never chosen; it is taken from the Digimon in focus. The chrome stays graphite so the subject can supply the color. Never hard-code a brand hue where `--accent` belongs.

**The No Sole-Channel Rule.** Color never carries meaning alone. Every attribute, resistance, domain accent, and route-step kind is paired with a name, a glyph (◆ ⧉ ❖ ▲ ▼), or a shape badge. If you remove all color, the interface must still be readable.

## 3. Typography

**Display / Body Font:** Hanken Grotesk (with `system-ui, sans-serif`)
**Brand Font:** Chakra Petch (with `Hanken Grotesk, system-ui, sans-serif`) — wordmark and splash only
**Label Font:** Hanken Grotesk (same family, uppercase treatment)

**Character:** One humanist sans carries the entire interface — headings, body, labels, and data — with hierarchy built from weight and size, not from a second face. A single squared, "digital" face (Chakra Petch) appears only in the wordmark and splash to stamp the game's identity; it never touches data or UI copy.

### Hierarchy
- **Brand** (Chakra Petch, 700, `-0.01em`): the wordmark and splash only. The one place the digital face is allowed.
- **Heading** (Hanken Grotesk, 700, `-0.01em`, ~15px panel titles up to the splash headline): `h1`–`h4`; `text-wrap: balance` where it wraps.
- **Body** (Hanken Grotesk, 400, 14px base, line-height 1.5): all copy and data. Prose measures cap at 65–75ch; dense tables may run wider.
- **Label** (Hanken Grotesk, 700, 11px, uppercase, `letter-spacing: 0.6px`, `--text-dim`): the global `.label` kicker for group labels (filter groups, section labels). Deliberate and sparse — a named system utility, not an eyebrow over every block.

### Scale

A single documented step scale (`--fs-*`, defined in `tokens.css`) carries the whole UI — a dense data tool legitimately needs more steps than a brand page, but not the ~17 near-duplicate literals that had accreted (the 8.5 / 9.5 / 11.5 / 12.5 / 13.5 twins are consolidated away):

`--fs-micro` 9px · `--fs-2xs` 10.5px · `--fs-xs` 11px · `--fs-sm` 12px · `--fs-md` 13px · `--fs-base` 14px · `--fs-lg` 15px · `--fs-input` 16px · `--fs-xl` 17px · `--fs-2xl` 21px.

`--fs-input` stays at 16px on form fields — below it, iOS zooms the page on focus. Reach for a token, never a literal px.

**The One-Family Rule.** Hierarchy comes from weight and size within Hanken Grotesk, never from adding another body face. Two similar sans faces are prohibited.

**The Brand-Face Firewall.** Chakra Petch is for the wordmark and splash only. It never labels a control, a stat, or a row. Data always wears the humanist face.

## 4. Elevation

Flat by default. Depth is built by tonal layering of the neutral ramp (`bg` < `surface` < `surface-2`), not by shadow. Shadows are reserved for genuinely floating layers, and there are exactly two, both themed so they read on graphite and on parchment.

### Shadow Vocabulary
- **Dropdown** (`box-shadow: 0 12px 32px oklch(0.08 0.01 66 / 0.6)` dark; `… / 0.2` light): search results and popovers that lift off the surface.
- **Panel** (`box-shadow: -10px 0 30px oklch(0.08 0.01 66 / 0.32)` dark; `… / 0.12` light): the side detail panel / mobile bottom-sheet edge.

**The Flat-Stage Rule.** Surfaces are flat at rest; if something has a drop shadow it must actually float above the page (a dropdown, the panel). Never use shadow as decoration to make a resting card "pop."

**The Top-Layer Popover Rule.** Any menu or tip that overlays the detail panel or the mobile bottom sheet is a native `[popover]` (rendered in the browser's top layer), never an absolutely-positioned dropdown nested in the top bar. A nested dropdown is capped by its ancestor's stacking context — `--z-topbar` (20) sits below `--z-panel` (40), so it paints *behind* the panel on mobile no matter its own z-index; the top layer clears every stacking context. Position it in JS under its trigger and keep the `--shadow-dropdown` + a brief `pop-in`.

## 5. Components

Components are tactile and confident: solid graphite fills at rest, a wash of the live accent when active, thin borders that warm toward the accent on hover, and a small press response. Every interactive element shares one tokenized `:focus-visible` ring (`2px solid var(--focus-ring)`, `2px` offset).

### Buttons
- **Shape:** small radius (`--radius-sm`, 7px); toolbar toggles are `SegButton`.
- **Default (`SegButton`):** `surface-2` fill, `1px` border, `--font-display`; sizes `sm` (4/10px) and `md` (5/12px).
- **Hover / Active:** hover warms the border toward the accent (`color-mix … 55%`); active fills with `--accent-soft` and a stronger accent border (`… 70%`); `:active` scales to `0.96` (`--dur-press`) — the whole toolbar shares this one tactile feedback.
- **Icon buttons** (close, swap, pager): `surface-2` circle/rounded, accent border + `--accent-faint` wash on hover, `scale(0.92)` on press.

### Chips
- **Filter chips (`FilterChip`):** pill (`--radius-pill`), transparent at rest, `1px border`, `--text-dim`, `--font-display` 11/600; carry `aria-pressed`. Active = tinted fill (`color-mix … 16%`) + accent-warmed border, text to `--text`. A `--chip-color` variable lets attribute/domain chips tint their own hover/active (attribute chips add a leading rounded swatch). Touch target ≥36px.
- **Badge chips (`Chip`):** display-only pills, same shape; a `tinted` variant fills at 15% for domain hues (item / jogress / bond), label always `--text` so color is never the sole channel.

### Requirement chips (`StatReqChip`)
- **Base:** an outlined chip reading `STAT ≥ value`. Agent rank is near-universal, so on the detail card it sits on the *"How to obtain"* title row and beside each evolves-to name — leaving the pill row for the requirements that actually vary (stats, talent, item ◆, bond ❖).
- **Reduced:** when the player's Agent Skills ease a requirement, the chip tints `--bond` and reads `base → reduced` — the base greyed (`--text-mute`), an arrow carrying the "reduced to" sense, the reduced value bold (`--text`). Both numbers stay visible; the base is never hidden. Tabular figures; each `STAT base → reduced` unit is unbreakable so it never wraps mid-stat. The same read carries into the route steps, the route-summary ceiling, and (compact) the evolves-to sub-line.

**The Both-Numbers Rule.** A value changed by a player setting shows its origin — `base → reduced`, base quiet, result bold — so the arithmetic is visible and the original is never lost.

### Inputs
- **Style:** `surface-2` fill, `1px` border, `--radius-sm`; search and endpoint fields.
- **Focus:** border shifts to `--accent` (plus the global focus ring on keyboard focus). On touch, fields grow to ≥40px min-height and 16px font (stops iOS zoom).

### Checkbox
- **Style:** a native `<input>` wrapped in a `<label>` (full semantics/keyboard), with the visible 16px box drawn as a sibling: `surface-2` fill, `1px` border, `5px` radius.
- **Checked:** fills with the live `--accent`, checkmark in `--accent-ink`, with a brief scale-in; hover warms the border to the accent. The control follows the current Digimon's color like everything else.

### Steppers
- **Style (`Stepper`):** a compact −/value/+ control on a `surface-2` fill, `1px` border, `--radius-sm`; the value is `--font-display` 700 with tabular figures. The − / + buttons wash `--accent-faint` and warm to `--accent` on hover, and disable at the bounds. For small bounded integers (the 0–4 Agent-Skill stacks in Settings); touch bumps the buttons to 40px.

### Navigation
- **Top bar** (`--topbar-height` 54px): wordmark (`BrandMark`, Chakra Petch), the Tree ⇄ Field guide `ViewSwitch`, search, and action toggles (`SegButton`). Active view reads via the accent-soft fill.

### Popovers (menus & tips)
Floating layers use the native Popover API so they sit in the top layer and clear the detail-panel / bottom-sheet stacking context (see **The Top-Layer Popover Rule**); each is positioned in JS under its trigger and carries the `--shadow-dropdown` plus a brief `pop-in`.
- **Help tip (`InfoTip`):** a `?` on a small `surface-2` pill opens a `surface` bubble with an on-demand explanation and an optional foot action (e.g. *"Open settings →"* in `--accent`). Light-dismiss + Escape; works on pointer, keyboard, and touch (click toggles).
- **Menus (`SettingsMenu`, `HiddenBranches`):** `popover="manual"`, driven by store/state (so they can also be opened from elsewhere — e.g. the detail panel's "Open settings"), with our own outside-pointer + captured-Escape dismissal so Escape closes the menu without also unwinding lineage focus / the route via the global key handler. Height-capped with internal scroll for short screens.

### Signature: the chromatic graph & detail panel
- **Graph (Cytoscape):** a themed viewport where node cards stay bright and each selected node glows in its *own* signature color (`data(accent)`); edges are colored by lineage direction and route role. This is the system's centerpiece and the reason the chrome stays quiet.
- **Detail panel (`Panel`, 384px):** `surface` fill, panel shadow, dense requirement chips (rank, stats, item ◆, jogress ⧉, bond ❖), stat bars that fill on a `scaleX` transition. On mobile it becomes a bottom sheet.

## 6. Do's and Don'ts

### Do:
- **Do** take the accent from the selected Digimon (`--accent`, repainted by `chroma.ts`); let the graphite chrome recede so the subject leads.
- **Do** author color in OKLCH and reach for a token (`--surface-2`, `--radius-sm`, `--transition-fast`, `--z-dropdown`) before any literal value.
- **Do** pair every color with a second channel — a name, a glyph (◆ ⧉ ❖ ▲ ▼), or a shape badge.
- **Do** keep components tactile: `surface-2` fills, `--accent-soft` active states, a `scale(0.96)` press, brisk `130ms` transitions.
- **Do** reserve the chromatic morph and other motion for meaning (state, feedback, the accent sweep), and honor `prefers-reduced-motion` — the global rule neutralizes transitions; don't fight it.
- **Do** build depth by stacking `bg` → `surface` → `surface-2`; add a shadow only when an element genuinely floats.
- **Do** render any menu or tip that overlays the panel or bottom sheet as a native `[popover]` in the top layer, positioned in JS under its trigger — never an absolutely-positioned dropdown nested in the top bar (it paints behind the panel on mobile).
- **Do** show a player-modified value as `base → reduced` (base greyed, arrow, result bold); never hide the original, and keep each `STAT base → reduced` block unbreakable.
- **Do** keep Chakra Petch to the wordmark and splash; everything else is Hanken Grotesk, hierarchy by weight.

### Don't:
- **Don't** ship the generic AI-slop SaaS look: no cream/beige backgrounds, no gradient text (`background-clip: text`), no identical icon-card grids, no tracked-uppercase eyebrow over every section, no hero-metric template.
- **Don't** drift toward a cluttered fan-wiki (ad-slots, dense tables with no hierarchy, inconsistent styling) or a bare spreadsheet dump (a raw grid with no craft or interactivity). These are the named anti-references.
- **Don't** use a `border-left`/`border-right` greater than 1px as a colored accent stripe on cards, rows, or callouts — full borders or background tints instead.
- **Don't** use glassmorphism as decoration; blur is not a default surface treatment here.
- **Don't** hard-code a brand hue where `--accent` belongs, or let color be the only thing distinguishing two states.
- **Don't** put a display/second face on data, labels, or controls; and never nest cards inside cards.
