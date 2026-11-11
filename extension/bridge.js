// Runs on Tack's own pages. Hands waiting clips to the open board, which places them and says "ack".
// Only the tab you're looking at gets them, so two open Tack tabs don't both add the same thing.

(() => {
  const ORIGIN = location.origin;
  let appReady = false;

  const send = async () => {
    if (!appReady || document.visibilityState !== "visible") return;
    const { queue = [] } = await chrome.storage.local.get("queue");
    if (queue.length) window.postMessage({ source: "tack-extension", type: "clips", items: queue }, ORIGIN);
  };

  window.addEventListener("message", async (e) => {
    if (e.source !== window || e.origin !== ORIGIN || e.data?.source !== "tack-app") return;
    if (e.data.type === "ready") { appReady = true; send(); }
    if (e.data.type === "gone") appReady = false; // left the board
    if (e.data.type === "ack" && Array.isArray(e.data.ids)) {
      const done = new Set(e.data.ids);
      const { queue = [] } = await chrome.storage.local.get("queue");
      await chrome.storage.local.set({ queue: queue.filter((i) => !done.has(i.id)) });
    }
  });

  chrome.storage.onChanged.addListener((c, area) => { if (area === "local" && c.queue) send(); });
  document.addEventListener("visibilitychange", send);

  // let Tack know the extension is installed
  const hello = () => window.postMessage({ source: "tack-extension", type: "hello" }, ORIGIN);
  hello();
  window.addEventListener("message", (e) => { if (e.source === window && e.data?.source === "tack-app" && e.data.type === "ping") hello(); });
})();
