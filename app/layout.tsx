import type { Metadata } from "next";
// font is bundled with the app (no external requests)
import "@fontsource-variable/geist";
import "./globals.css";

export const metadata: Metadata = {
  title: "Research Board",
  description: "A canvas for visual research, with an AI research assistant.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
