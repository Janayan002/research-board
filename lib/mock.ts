// Fake results used when no API key is set, so you can build and test the UI for free.

import type { GeneratedCard } from "./types";
import type { ResearchType } from "./researchTypes";

const FAKE: Record<string, string[]> = {
  artist: ["Mira Okafor", "Tomas Lindqvist", "Hana Seo", "Rafael Duarte", "June Park", "Ilse Varga", "Kofi Mensah", "Lena Hoffmann", "Arjun Rao", "Noor Haddad", "Wen Li", "Sofia Marin"],
  museum: ["Riverside Craft Museum", "Northgate Art Center", "The Glasshouse Gallery", "Meridian Kunsthalle", "Old Mill Arts Space", "Harbor Design Museum"],
  article: ["On Waiting Rooms", "The Bus Stop as Stage", "Notes on Transit Memory", "Shelter, Signal, Schedule", "Small Architectures", "The Commute as Material"],
  exhibition: ["Between Stops", "Home, Elsewhere", "Timetables", "Public Rooms", "Transit Lines", "After Departure"],
  product: ["Moodstack", "Pinboard Pro", "CanvasNote", "RefLens", "Clipwall", "BoardKit"],
  any: ["Result A", "Result B", "Result C", "Result D", "Result E", "Result F"],
};
const META: Record<string, string> = {
  artist: "Berlin, sculpture", museum: "Chicago, USA, museum", article: "A. Writer, Example Review, 2024",
  exhibition: "Example Kunsthalle, 2023", product: "Example Inc, web and iOS", any: "example",
};

export function mockCandidates(query: string, rt: ResearchType, count: number, exclude: string[]) {
  const pool = (FAKE[rt.id] ?? FAKE.any).filter((n) => !exclude.includes(`${n} (mock)`));
  return pool.slice(0, count).map((n, i) => ({
    name: `${n} (mock)`,
    meta: META[rt.id],
    why: `Placeholder ${rt.singular} #${i + 1} for “${query.slice(0, 60)}”. Add an API key to get real results.`,
    sourceUrl: "https://example.com/",
    sourceTitle: "example.com (mock source)",
  }));
}

function placeholderImage(name: string) {
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400">
    <rect width="100%" height="100%" fill="hsl(${hue},45%,82%)"/>
    <circle cx="470" cy="150" r="90" fill="hsl(${hue},45%,70%)"/>
    <rect x="60" y="230" width="260" height="110" fill="hsl(${(hue + 40) % 360},40%,72%)"/>
    <text x="60" y="80" font-family="sans-serif" font-size="28" fill="hsl(${hue},30%,30%)">${name.replace(/[<&]/g, "")}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function mockCard(name: string, rt: ResearchType, labels: string[]): GeneratedCard {
  return {
    name,
    subtitle: META[rt.id],
    website: "https://example.com/",
    image: placeholderImage(name),
    sections: labels.map((label) => ({
      label,
      text: `Mock text for “${label}”. With a real API key, Claude searches the web and writes this section from sources it found, with links below.`,
    })),
    sources: [{ title: "example.com (mock source)", url: "https://example.com/" }],
    mock: true,
  };
}
