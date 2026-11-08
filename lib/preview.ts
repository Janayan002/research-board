"use client";

// Which web page is open in the preview pane (shared by the search panel and cards).

import { create } from "zustand";

type PreviewState = {
  url: string | null;
  open: (url: string) => void;
  close: () => void;
};

export const usePreview = create<PreviewState>((set) => ({
  url: null,
  open: (url) => set({ url }),
  close: () => set({ url: null }),
}));

// For <a> clicks: open in the preview pane, unless Cmd/Ctrl/Shift-click (then the browser handles it).
export function previewClick(e: React.MouseEvent, url?: string) {
  if (!url || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  usePreview.getState().open(url);
}
