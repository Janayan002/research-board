// Shared data shapes for the whole app.

export type Source = { title: string; url: string };

export type Section = { label: string; text: string };

type BaseCard = {
  id: string;
  x: number; // position on the canvas (world units = frame pixels)
  y: number;
  w: number; // width; height grows with content
  scale?: number; // visual scale, so cards added while zoomed out are still readable
  createdAt: number;
};

export type NoteCard = BaseCard & { kind: "note"; text: string; color: string };
export type LinkCard = BaseCard & { kind: "link"; url: string; title: string };
export type ImageCard = BaseCard & {
  kind: "image";
  src: string;
  caption?: string;
  sourceUrl?: string;
};
export type ArtistCard = BaseCard & {
  kind: "artist";
  name: string;
  image?: string;
  website?: string;
  sections: Section[];
  sources: Source[];
};

export type Card = NoteCard | LinkCard | ImageCard | ArtistCard;
export type CardKind = Card["kind"];

export type CandidateStatus = "new" | "kept" | "skipped" | "added";

export type Candidate = {
  id: string;
  name: string;
  why: string; // one line: why this matches the prompt
  sourceUrl?: string;
  sourceTitle?: string;
  status: CandidateStatus;
};

export type ResearchSession = {
  id: string;
  query: string;
  candidates: Candidate[];
  createdAt: number;
  mock?: boolean;
};

export type Frame = { w: number; h: number; preset: string };

export type Viewport = { x: number; y: number; zoom: number };

export type Board = {
  id: string;
  name: string;
  frame: Frame;
  cards: Card[];
  research: ResearchSession[]; // newest first
  viewport?: Viewport;
  createdAt: number;
  updatedAt: number;
};

// What the /api/card route returns
export type GeneratedCard = {
  name: string;
  website?: string;
  image?: string;
  sections: Section[];
  sources: Source[];
  mock?: boolean;
};
