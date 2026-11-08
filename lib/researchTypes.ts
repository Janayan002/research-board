// Research types: what you're searching for, and what a card about it contains.
// Add a new type here and it shows up in the research panel automatically.

export type SectionDef = { id: string; label: string; instruction: string; defaultOn?: boolean };

export type ResearchType = {
  id: string;
  label: string; // chip label in the panel
  singular: string; // "artist", "museum", ...
  placeholder: string; // example prompt
  find: string; // what a search result is, told to the AI
  metaHint: string; // what the short line under each result should say
  sections: SectionDef[];
};

const relevance: SectionDef = {
  id: "relevance", label: "Connection to my research",
  instruction: "2–3 sentences on how this connects to the user's research prompt — specific, not generic.",
};

export const RESEARCH_TYPES: ResearchType[] = [
  {
    id: "artist",
    label: "Artists",
    singular: "artist",
    placeholder: "e.g. sculptural artists who make work about bus stations",
    find: "artists, designers, collectives or studios (real people or groups)",
    metaHint: "where they are based, main medium",
    sections: [
      { id: "bio", label: "Short bio", defaultOn: true, instruction: "2–4 sentences: who they are, where they're based, their medium and main concerns." },
      { id: "works", label: "Key works", instruction: "2–4 notable works or projects, each with title, year if known, and one line on what it is." },
      { id: "process", label: "Materials & process", instruction: "2–3 sentences on materials, techniques, scale and how the work is made or experienced." },
      relevance,
      { id: "exhibitions", label: "Exhibitions & where to see", instruction: "Recent or notable exhibitions, galleries or collections that show the work." },
    ],
  },
  {
    id: "museum",
    label: "Museums & galleries",
    singular: "museum or gallery",
    placeholder: "e.g. museums and art spaces focused on craft and design in the Midwest",
    find: "museums, galleries, art centers, residencies or other art institutions and spaces",
    metaHint: "city, country, type of institution",
    sections: [
      { id: "about", label: "About", defaultOn: true, instruction: "2–3 sentences: what kind of institution it is, where, and its mission or character." },
      { id: "collection", label: "Collection & focus", instruction: "What they collect or show: periods, media, notable holdings or programs." },
      { id: "shows", label: "Recent & upcoming exhibitions", instruction: "2–4 recent or upcoming exhibitions with dates if known. Say if dates may be out of date." },
      { id: "opportunities", label: "Opportunities", instruction: "Open calls, residencies, internships, jobs or education programs, if any are listed. Say if none found." },
      { id: "visit", label: "Location & visiting", instruction: "Address/neighborhood and how to visit (admission basics). Do not invent hours." },
      relevance,
    ],
  },
  {
    id: "article",
    label: "Articles & writing",
    singular: "article or text",
    placeholder: "e.g. essays on waiting, public transit and memory in contemporary art",
    find: "articles, essays, interviews, reviews, academic papers or books (real, findable texts)",
    metaHint: "author, publication, year",
    sections: [
      { id: "summary", label: "Summary", defaultOn: true, instruction: "3–4 sentences in your own words summarizing the text. Do not quote long passages." },
      { id: "ideas", label: "Key ideas", instruction: "3–5 short points: the main arguments or ideas." },
      { id: "author", label: "Author & publication", instruction: "Who wrote it, where it was published, when, and why that source matters." },
      relevance,
      { id: "further", label: "Further reading", instruction: "2–3 related texts or authors worth looking at next." },
    ],
  },
  {
    id: "exhibition",
    label: "Exhibitions",
    singular: "exhibition",
    placeholder: "e.g. exhibitions about migration and home, 2020–now",
    find: "exhibitions, biennials, festivals or shows (past, current or upcoming)",
    metaHint: "venue, dates",
    sections: [
      { id: "overview", label: "Overview", defaultOn: true, instruction: "2–3 sentences: the theme and premise of the show." },
      { id: "artists", label: "Artists & works", instruction: "Notable artists and works included." },
      { id: "venue", label: "Venue, dates & curators", instruction: "Where and when it ran, and who curated it." },
      { id: "reception", label: "Reviews & reception", instruction: "How critics or press responded, in your own words." },
      relevance,
    ],
  },
  {
    id: "product",
    label: "Apps & products",
    singular: "app or product",
    placeholder: "e.g. existing apps for visual research boards with AI search",
    find: "apps, websites, tools, devices or products (real, currently or recently available)",
    metaHint: "company, platforms",
    sections: [
      { id: "what", label: "What it does", defaultOn: true, instruction: "2–3 sentences: what it is and who it's for." },
      { id: "features", label: "Key features", instruction: "3–5 standout features." },
      { id: "pricing", label: "Pricing & platforms", instruction: "Pricing model and platforms, as currently listed. Say if unclear." },
      { id: "gaps", label: "Strengths & gaps", instruction: "What it does well and what it's missing, based on reviews or its own docs." },
      { id: "maker", label: "Who makes it", instruction: "Company or person behind it, and when it launched." },
      relevance,
    ],
  },
  {
    id: "any",
    label: "Anything",
    singular: "result",
    placeholder: "e.g. history of the bus stop sign as a designed object",
    find: "the most relevant things for this request: people, places, texts, projects, objects or ideas",
    metaHint: "what kind of thing it is",
    sections: [
      { id: "summary", label: "Summary", defaultOn: true, instruction: "3–4 sentences: what this is and why it matters." },
      { id: "facts", label: "Key facts", instruction: "3–5 short, verified facts." },
      relevance,
    ],
  },
];

export const researchType = (id?: string) => RESEARCH_TYPES.find((t) => t.id === id) ?? RESEARCH_TYPES[0];
export const defaultSectionIds = (typeId?: string) => researchType(typeId).sections.filter((s) => s.defaultOn).map((s) => s.id);
