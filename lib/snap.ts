// Snapping while you drag cards (like Figma): edges and centres line up with other cards and the
// page, and gaps between cards snap to equal spacing. Pure maths; the canvas draws the result.

export type Box = { x: number; y: number; w: number; h: number };
// a thin line to draw: at x=at from y=from to y=to (axis "x"), or at y=at from x=from to x=to (axis "y")
export type Guide = { axis: "x" | "y"; at: number; from: number; to: number };
// a measured gap to label: along the axis from..to, drawn at the cross position `at`
export type GapMark = { axis: "x" | "y"; from: number; to: number; at: number };

export type Snap = { dx: number; dy: number; guides: Guide[]; gaps: GapMark[] };

const flip = (b: Box): Box => ({ x: b.y, y: b.x, w: b.h, h: b.w });

// Snap `box` (the moving selection) against `others` and the page frame. `tol` is in world units.
export function snapTo(box: Box, others: Box[], frame: { w: number; h: number }, tol: number): Snap {
  const sx = snapAxis(box, others, { w: frame.w, h: frame.h }, tol);
  const sy = snapAxis(flip(box), others.map(flip), { w: frame.h, h: frame.w }, tol);
  return {
    dx: sx.d, dy: sy.d,
    guides: [
      ...sx.guides.map((g) => ({ axis: "x" as const, ...g })),
      ...sy.guides.map((g) => ({ axis: "y" as const, ...g })),
    ],
    gaps: [
      ...sx.gaps.map((g) => ({ axis: "x" as const, ...g })),
      ...sy.gaps.map((g) => ({ axis: "y" as const, ...g })),
    ],
  };
}

type AxisSnap = { d: number; guides: { at: number; from: number; to: number }[]; gaps: { from: number; to: number; at: number }[] };

// One axis: x is "along", y is "across". Returns how far to move along the axis.
function snapAxis(box: Box, others: Box[], frame: { w: number; h: number }, tol: number): AxisSnap {
  const none: AxisSnap = { d: 0, guides: [], gaps: [] };
  const right = (b: Box) => b.x + b.w, bottom = (b: Box) => b.y + b.h, mid = (b: Box) => b.x + b.w / 2;

  // 1. edges and centres
  let best: { d: number; at: number; from: number; to: number } | null = null;
  const consider = (edge: number, target: number, from: number, to: number) => {
    const d = target - edge;
    if (Math.abs(d) <= tol && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, at: target, from, to };
  };
  const edges = [box.x, mid(box), right(box)];
  for (const o of others) {
    const from = Math.min(box.y, o.y), to = Math.max(bottom(box), bottom(o));
    for (const e of edges) for (const t of [o.x, mid(o), right(o)]) consider(e, t, from, to);
  }
  for (const e of edges) for (const t of [0, frame.w / 2, frame.w]) consider(e, t, 0, frame.h);

  // 2. equal spacing with cards in the same row
  const mates = others.filter((o) => o.y < bottom(box) && bottom(o) > box.y);
  const lefts = mates.filter((o) => right(o) <= mid(box)).sort((a, b) => right(b) - right(a)); // nearest first
  const rights = mates.filter((o) => o.x >= mid(box)).sort((a, b) => a.x - b.x);
  let space: { d: number; gaps: { from: number; to: number }[] } | null = null;
  const tryGap = (targetX: number, gaps: { from: number; to: number }[]) => {
    const d = targetX - box.x;
    if (Math.abs(d) <= tol && (!space || Math.abs(d) < Math.abs(space.d))) space = { d, gaps };
  };
  const L = lefts[0], R = rights[0];
  if (L && R) {
    const room = R.x - right(L) - box.w;
    if (room > 0) { const t = right(L) + room / 2; tryGap(t, [{ from: right(L), to: t }, { from: t + box.w, to: R.x }]); }
  }
  if (L && lefts[1]) {
    const g = L.x - right(lefts[1]);
    if (g > 0) tryGap(right(L) + g, [{ from: right(lefts[1]), to: L.x }, { from: right(L), to: right(L) + g }]);
  }
  if (R && rights[1]) {
    const g = rights[1].x - right(R);
    if (g > 0) { const t = R.x - g - box.w; tryGap(t, [{ from: t + box.w, to: R.x }, { from: right(R), to: rights[1].x }]); }
  }

  const b = best as { d: number; at: number; from: number; to: number } | null;
  const s = space as { d: number; gaps: { from: number; to: number }[] } | null;
  if (s && (!b || Math.abs(s.d) <= Math.abs(b.d))) {
    const at = box.y + box.h / 2; // gap labels sit level with the middle of the moving card
    return { d: s.d, guides: [], gaps: s.gaps.map((g) => ({ ...g, at })) };
  }
  if (b) return { d: b.d, guides: [{ at: b.at, from: b.from, to: b.to }], gaps: [] };
  return none;
}
