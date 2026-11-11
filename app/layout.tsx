import type { Metadata } from "next";
// font is bundled with the app (no external requests)
import "@fontsource-variable/archivo"; // the UI grotesk, in heavy and medium weights
import "@fontsource/caveat/500.css"; // handwriting for notes
import "./globals.css";
import { GOOGLE_FONTS_URL } from "@/lib/fonts";
import ConnectAI from "@/components/ConnectAI";
import AccountSync from "@/components/AccountSync";

export const metadata: Metadata = {
  title: "Tack",
  description: "A canvas for visual research, with an AI research assistant.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* fonts for the Text tool */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={GOOGLE_FONTS_URL} />
      </head>
      <body>{children}<ConnectAI /><AccountSync /></body>
    </html>
  );
}
