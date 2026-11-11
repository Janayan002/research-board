import type { TextCard } from "./types";

// Basic Google Fonts offered by the Text tool. They're loaded in app/layout.tsx.

export type TextFont = { name: string; family: string; kind: "Sans" | "Serif" | "Display" | "Hand" | "Mono" };

export const TEXT_FONTS: TextFont[] = [
  { name: "Inter", family: '"Inter", sans-serif', kind: "Sans" },
  { name: "Roboto", family: '"Roboto", sans-serif', kind: "Sans" },
  { name: "Open Sans", family: '"Open Sans", sans-serif', kind: "Sans" },
  { name: "Lato", family: '"Lato", sans-serif', kind: "Sans" },
  { name: "Montserrat", family: '"Montserrat", sans-serif', kind: "Sans" },
  { name: "Poppins", family: '"Poppins", sans-serif', kind: "Sans" },
  { name: "Playfair Display", family: '"Playfair Display", serif', kind: "Serif" },
  { name: "Merriweather", family: '"Merriweather", serif', kind: "Serif" },
  { name: "Lora", family: '"Lora", serif', kind: "Serif" },
  { name: "Oswald", family: '"Oswald", sans-serif', kind: "Display" },
  { name: "Bebas Neue", family: '"Bebas Neue", sans-serif', kind: "Display" },
  { name: "Caveat", family: '"Caveat", cursive', kind: "Hand" },
  { name: "Roboto Mono", family: '"Roboto Mono", monospace', kind: "Mono" },
];

export const DEFAULT_FONT = "Inter";
export const TEXT_SIZES = [12, 14, 16, 20, 24, 32, 40, 48, 64, 80, 96];
export const TEXT_COLORS = ["#000000", "#302c4d", "#6b6b69", "#ffffff", "#c2410c", "#b91c1c", "#1d4ed8", "#15803d"];

export const fontFamily = (name: string) => TEXT_FONTS.find((f) => f.name === name)?.family ?? `"${name}", sans-serif`;

// one stylesheet request for every font above
export const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?" +
  TEXT_FONTS.map((f) => `family=${f.name.replace(/ /g, "+")}${f.name === "Bebas Neue" ? "" : ":wght@400;700"}`).join("&") +
  "&display=swap";

// new text boxes use the font/size/color of the last text box you styled
type TextStyle = Pick<TextCard, "font" | "size" | "color" | "bold">;
const DEFAULT_TEXT: TextStyle = { font: DEFAULT_FONT, size: 24, color: "#000000" };
export const lastTextStyle = (): TextStyle => {
  try { return { ...DEFAULT_TEXT, ...JSON.parse(localStorage.getItem("text-style") || "{}") }; } catch { return DEFAULT_TEXT; }
};
export const rememberTextStyle = (s: Partial<TextStyle>) => {
  try { localStorage.setItem("text-style", JSON.stringify({ ...lastTextStyle(), ...s })); } catch {}
};
