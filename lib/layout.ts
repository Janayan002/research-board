// All pages of a board sit side by side on one canvas (like frames in Figma).
// Cards keep page-relative positions; a page's offset turns them into canvas ("world") positions.

import type { Board, Frame } from "./types";

export const pageGap = (f: Frame) => Math.round(Math.max(160, f.w * 0.08));
export const pageStep = (f: Frame) => f.w + pageGap(f);

export const pageOffset = (b: Board, i: number) => ({ x: i * pageStep(b.frame), y: 0 });

// which page a canvas x position belongs to (the gap between two pages is split down the middle)
export function pageIndexAt(b: Board, worldX: number) {
  const step = pageStep(b.frame);
  const i = Math.floor((worldX + pageGap(b.frame) / 2) / step);
  return Math.max(0, Math.min(b.pages.length - 1, i));
}

// the canvas area covered by pages a..z (inclusive)
export function pagesBox(b: Board, a: number, z = a) {
  const lo = Math.min(a, z), hi = Math.max(a, z);
  const x0 = pageOffset(b, lo).x;
  return { x: x0, y: 0, w: pageOffset(b, hi).x + b.frame.w - x0, h: b.frame.h };
}
