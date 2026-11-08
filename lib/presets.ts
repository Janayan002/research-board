// Frame size presets for the start screen (like Figma's frame picker).

export type Preset = { id: string; group: string; label: string; w: number; h: number };

export const PRESETS: Preset[] = [
  { id: "board-wide", group: "Research", label: "Research board", w: 2400, h: 1600 },
  { id: "board-square", group: "Research", label: "Square board", w: 2000, h: 2000 },
  { id: "slide-16-9", group: "Presentation", label: "Slide 16:9", w: 1920, h: 1080 },
  { id: "slide-4-3", group: "Presentation", label: "Slide 4:3", w: 1024, h: 768 },
  { id: "a4-portrait", group: "Paper", label: "A4 portrait", w: 794, h: 1123 },
  { id: "a4-landscape", group: "Paper", label: "A4 landscape", w: 1123, h: 794 },
  { id: "letter", group: "Paper", label: "US Letter", w: 816, h: 1056 },
  { id: "tabloid", group: "Paper", label: "Tabloid 11×17", w: 1056, h: 1632 },
  { id: "ig-post", group: "Social", label: "Instagram post", w: 1080, h: 1350 },
  { id: "ig-story", group: "Social", label: "Story", w: 1080, h: 1920 },
];

export const NOTE_COLORS = ["#EDEDED", "#FFFFFF", "#BDBDBD", "#E9D9A6", "#C9D9EA", "#E6C8C2"];
