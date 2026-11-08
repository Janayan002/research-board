import type { Metadata } from "next";
// fonts are bundled with the app (no external requests)
import "@fontsource-variable/bricolage-grotesque/wdth.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
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
