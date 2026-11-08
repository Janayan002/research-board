// Fake results used when no API key is set, so you can build and test the UI for free.

import type { GeneratedCard } from "./types";

const FAKE = [
  "Mira Okafor", "Tomas Lindqvist", "Hana Seo", "Rafael Duarte", "June Park", "Ilse Varga",
  "Kofi Mensah", "Lena Hoffmann", "Arjun Rao", "Noor Haddad", "Wen Li", "Sofia Marin",
];

export function mockCandidates(query: string, count: number, exclude: string[]) {
  const pool = FAKE.filter((n) => !exclude.includes(`${n} (mock)`));
  return pool.slice(0, count).map((n, i) => ({
    name: `${n} (mock)`,
    why: `Placeholder result #${i + 1} for “${query.slice(0, 60)}”. Add an API key to get real artists.`,
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

export function mockCard(name: string, labels: string[]): GeneratedCard {
  return {
    name,
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
