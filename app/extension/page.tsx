"use client";

// How to install the Tack Clipper browser extension.

import Link from "next/link";
import { useHasExtension } from "@/lib/extension";

export default function ExtensionPage() {
  const installed = useHasExtension();
  return (
    <main className="ext-page">
      <div className="ext-card">
        <nav className="pipe-nav sm" aria-label="Back"><Link href="/">Tack</Link></nav>
        <div className="ext-head">
          <h1>Tack Clipper</h1>
          {installed && <span className="ext-installed">✓ Installed</span>}
        </div>
        <p className="ext-lead">
          Save images, links and text from any website to your board, with citations, including sites
          Tack can’t show in its preview, like Instagram.
        </p>

        <h2>Install (Chrome, Edge, Arc, Brave)</h2>
        <ol className="ext-steps">
          <li><a className="btn primary" href="/tack-extension.zip" download>Download the extension</a> and unzip it.</li>
          <li>Open <code>chrome://extensions</code> (copy it into the address bar).</li>
          <li>Turn on <b>Developer mode</b> (top right).</li>
          <li>Click <b>Load unpacked</b> and choose the unzipped folder.</li>
          <li>Pin it: click the puzzle icon in the toolbar, then the pin next to <b>Tack Clipper</b>.</li>
        </ol>

        <h2>Use it</h2>
        <ul className="ext-steps">
          <li><b>Right-click</b> an image, link or selected text → <b>Add … to Tack</b>.</li>
          <li>Click the <b>Tack icon</b> → <b>Pick images</b> to choose several images from the page. This also works on Instagram, where right-click doesn’t reach the picture.</li>
          <li>Saved items go to the board you have open in Tack. If none is open, they wait (the icon shows how many) until you open one.</li>
        </ul>
        <p className="muted" style={{ fontSize: 12.5 }}>
          Instagram and Facebook image links expire after a few days, so for those the Clipper saves a copy of the picture itself.
        </p>
      </div>
    </main>
  );
}
