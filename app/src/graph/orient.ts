// Orientation transform. The committed layout in layout.json is authored in a
// single "column" frame: x is the generation axis (In-Training I → Mega + →
// Hybrid), y is the digimon-spread axis (the many members of each generation).
//
// There are far more Digimon than there are stages, so the spread axis is the
// long one. Which screen axis it maps to is a display choice:
//   • columns — generations run left→right, members stack downward (tall + narrow)
//   • rows    — generations run top→bottom, members spread sideways (short + wide)
//
// Rows is just the transpose of columns, so a single swap covers both — and the
// transpose is its own inverse, so this maps base→display and display→base alike.

export type Orientation = 'rows' | 'columns';

export interface Pt {
  x: number;
  y: number;
}

/** Map a base (column-frame) point into display space for the chosen orientation. */
export const orient = (p: Pt, o: Orientation): Pt =>
  o === 'rows' ? { x: p.y, y: p.x } : { x: p.x, y: p.y };

/** How far the generation watermark sits off the band (px, base units). */
const GEN_LABEL_OFFSET = 170;

/**
 * Display position for a generation's watermark label. In columns it floats
 * above the column; in rows it sits in the left margin (text runs leftward, so
 * long names never collide with the band's members).
 */
export const genLabelPos = (genCoord: number, o: Orientation): Pt =>
  o === 'rows' ? { x: -40, y: genCoord } : { x: genCoord, y: -GEN_LABEL_OFFSET };

/** Display axis that generations vary along (the short axis). */
export const genAxis = (o: Orientation): 'x' | 'y' => (o === 'rows' ? 'y' : 'x');

/** Display axis that members spread along (the long axis). */
export const spreadAxis = (o: Orientation): 'x' | 'y' => (o === 'rows' ? 'x' : 'y');
