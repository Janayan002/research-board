import { TACK_URLS, inTab, readPageImages, readPageInfo, today } from "./shared.js";

const $ = (id) => document.getElementById(id);
let tab, page, images = [], picked = new Set();

const say = (text, bad = false) => { const m = $("msg"); m.textContent = text; m.className = `msg ${bad ? "bad" : ""}`; m.hidden = false; };

async function send(items) {
  await chrome.runtime.sendMessage({ type: "enqueue", items });
  say(`Saved ${items.length === 1 ? "1 item" : `${items.length} items`}. It’ll appear on the board you have open in Tack.`);
}

async function showQueue() {
  const { queue = [] } = await chrome.storage.local.get("queue");
  $("queue").textContent = queue.length ? `${queue.length} waiting — open a board in Tack to place ${queue.length === 1 ? "it" : "them"}` : "Everything’s on your board.";
}

async function init() {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  page = (tab?.id && (await inTab(tab.id, readPageInfo))) || null;
  $("pt").textContent = page?.title || tab?.title || "This page";
  $("ps").textContent = page ? `${page.siteName}${page.creator ? " · " + page.creator : ""}` : "Chrome doesn’t let extensions read this page.";
  if (!page) { $("save-page").disabled = true; $("pick").disabled = true; }
  showQueue();
}

$("save-page").onclick = () => send([{ kind: "link", url: page.pageUrl, title: page.title || "", cite: { ...page, accessed: today() } }]);

$("pick").onclick = async () => {
  images = (await inTab(tab.id, readPageImages)) || [];
  picked = new Set();
  $("images").hidden = false;
  $("count").textContent = images.length ? `${images.length} images on this page` : "No large images found on this page.";
  $("all").hidden = !images.length;
  const grid = $("grid");
  grid.replaceChildren(...images.map((img) => {
    const b = document.createElement("button");
    b.className = "cell";
    b.title = img.alt || img.src;
    b.dataset.src = img.src;
    const el = document.createElement("img");
    el.src = img.src; el.alt = img.alt || ""; el.referrerPolicy = "no-referrer"; el.loading = "lazy";
    el.onerror = () => b.remove();
    const t = document.createElement("span"); t.className = "tick";
    b.append(el, t);
    b.onclick = () => { picked.has(img.src) ? picked.delete(img.src) : picked.add(img.src); render(); };
    return b;
  }));
  render();
};

function render() {
  for (const b of $("grid").children) {
    const on = picked.has(b.dataset.src);
    b.classList.toggle("on", on);
    b.querySelector(".tick").textContent = on ? "✓" : "";
  }
  $("add").disabled = !picked.size;
  $("add").textContent = picked.size ? `Add ${picked.size} image${picked.size === 1 ? "" : "s"}` : "Add images";
  const shown = Array.from($("grid").children).map((b) => b.dataset.src);
  $("all").textContent = shown.length && shown.every((s) => picked.has(s)) ? "Clear" : "Select all";
}

$("all").onclick = () => {
  const shown = Array.from($("grid").children).map((b) => b.dataset.src); // broken images were removed
  picked = shown.every((s) => picked.has(s)) ? new Set() : new Set(shown);
  render();
};

$("add").onclick = async () => {
  const items = images.filter((i) => picked.has(i.src)).map((i) => ({
    kind: "image", src: i.src, cite: { ...page, title: i.alt || page.title, imageUrl: i.src, accessed: today() },
  }));
  $("add").disabled = true;
  $("add").textContent = "Saving…";
  await send(items);
  picked = new Set();
  render();
};

$("open").onclick = async () => {
  // switch to an open Tack tab if there is one
  const tabs = await chrome.tabs.query({ url: TACK_URLS.map((u) => u + "/*") });
  if (tabs[0]) { await chrome.tabs.update(tabs[0].id, { active: true }); await chrome.windows.update(tabs[0].windowId, { focused: true }); }
  else await chrome.tabs.create({ url: TACK_URLS[0] });
  window.close();
};

chrome.storage.onChanged.addListener((c, area) => { if (area === "local" && c.queue) showQueue(); });
init();
