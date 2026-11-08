// The kinds of content you can generate for a card. Add your own here.

export type SectionDef = { id: string; label: string; instruction: string; defaultOn?: boolean };

export const SECTIONS: SectionDef[] = [
  { id: "bio", label: "Short bio", defaultOn: true,
    instruction: "2–4 sentences: who they are, where they're based, their medium and main concerns." },
  { id: "works", label: "Key works",
    instruction: "2–4 notable works or projects, each with title, year if known, and one line on what it is." },
  { id: "process", label: "Materials & process",
    instruction: "2–3 sentences on materials, techniques, scale and how the work is made or experienced." },
  { id: "relevance", label: "Connection to my research",
    instruction: "2–3 sentences on how this work connects to the user's research prompt — specific, not generic." },
  { id: "exhibitions", label: "Exhibitions & where to see",
    instruction: "Recent or notable exhibitions, galleries or collections that show the work." },
];

export const sectionById = (id: string) => SECTIONS.find((s) => s.id === id);
