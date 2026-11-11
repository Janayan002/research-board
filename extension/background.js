// Tack Clipper background worker: right-click menus, and the queue of things waiting to go to Tack.
// Items wait in chrome.storage until a Tack board is open; then bridge.js hands them to the board.

import { altFor, inTab, readPageInfo, today, uid } from "./shared.js";

const MENUS = [
  { id: "tack-image", title: "Add image to Tack", contexts: ["image"] },
  { id: "tack-link", title: "Add link to Tack", contexts: ["link"] },
  { id: "tack-text", title: "Add selected text to Tack", contexts: ["selection"] },
  { id: "tack-page", title: "Add this page to Tack", contexts: ["page"] },
];

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => MENUS.forEach((m) => chrome.contextMenus.create(m)));
  updateBadge();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const page = (tab?.id && (await inTab(tab.id, readPageInfo))) || { pageUrl: info.pageUrl, title: tab?.title };
  const cite = { ...page, accessed: today() };
  if (info.menuItemId === "tack-image" && info.srcUrl) {
    const alt = tab?.id ? await inTab(tab.id, altFor, [info.srcUrl]) : undefined;
    await enqueue([{ kind: "image", src: info.srcUrl, cite: { ...cite, title: alt || cite.title, imageUrl: info.srcUrl } }]);
  } else if (info.menuItemId === "tack-link" && info.linkUrl) {
    await enqueue([{ kind: "link", url: info.linkUrl, title: info.selectionText || info.linkUrl, cite: { pageUrl: info.linkUrl, accessed: today() } }]);
  } else if (info.menuItemId === "tack-text" && info.selectionText) {
    await enqueue([{ kind: "text", text: info.selectionText.trim(), cite }]);
  } else if (info.menuItemId === "tack-page") {
    await enqueue([{ kind: "link", url: page.pageUrl || info.pageUrl, title: page.title || "", cite }]);
  }
});

// the popup sends its items here so they get the same treatment
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.type === "enqueue") { enqueue(msg.items).then(() => reply({ ok: true })); return true; }
});

async function enqueue(items) {
  const ready = await Promise.all(items.map(async (it) => ({ ...it, id: uid(), at: Date.now(), ...(it.kind === "image" ? await keepable(it) : {}) })));
  const { queue = [] } = await chrome.storage.local.get("queue");
  await chrome.storage.local.set({ queue: [...queue, ...ready] });
  flashBadge();
}

// Instagram and Facebook image links stop working after a few days, so save a copy of the picture itself
// (resized, so the board doesn't fill up the browser's storage).
const EXPIRING = /(^|\.)(cdninstagram\.com|fbcdn\.net)$/i;
async function keepable(it) {
  let host = "";
  try { host = new URL(it.src).hostname; } catch { return {}; }
  if (!EXPIRING.test(host)) return {};
  try {
    const blob = await (await fetch(it.src)).blob();
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
    const canvas = new OffscreenCanvas(Math.round(bmp.width * k), Math.round(bmp.height * k));
    canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const jpg = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.85 });
    const bytes = new Uint8Array(await jpg.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { src: `data:image/jpeg;base64,${btoa(bin)}` };
  } catch {
    return {}; // keep the link; it works for now
  }
}

async function updateBadge() {
  const { queue = [] } = await chrome.storage.local.get("queue");
  await chrome.action.setBadgeBackgroundColor({ color: "#1e1e1e" });
  await chrome.action.setBadgeText({ text: queue.length ? String(queue.length) : "" });
}
function flashBadge() { updateBadge(); }
chrome.storage.onChanged.addListener((c, area) => { if (area === "local" && c.queue) updateBadge(); });
