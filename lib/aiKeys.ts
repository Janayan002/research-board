"use client";

// The AI keys each person connects for themselves. Saved only in this browser (localStorage)
// and sent to Tack's server with each AI or search request, which passes them on to Claude / Brave.

import { create } from "zustand";
import { persist } from "zustand/middleware";

export const MODEL_CHOICES = [
  { id: "claude-opus-5-5", label: "Opus 5.5", note: "Best answers. Slower, and costs the most." },
  { id: "claude-sonnet-5-5", label: "Sonnet 5.5", note: "Very good answers for about half of Opus’s price." },
  { id: "claude-haiku-5-5", label: "Haiku 5.5", note: "Fast and very cheap, but less thorough." },
];

type KeysState = {
  anthropicKey: string;
  braveKey: string;
  model: string;
  dialogOpen: boolean;
  save: (k: { anthropicKey: string; braveKey: string; model: string }) => void;
  disconnect: () => void;
  openDialog: () => void;
  closeDialog: () => void;
};

export const useAiKeys = create<KeysState>()(
  persist(
    (set) => ({
      anthropicKey: "",
      braveKey: "",
      model: "claude-opus-5-5",
      dialogOpen: false,
      save: (k) => set({ ...k, dialogOpen: false }),
      disconnect: () => set({ anthropicKey: "", braveKey: "" }),
      openDialog: () => set({ dialogOpen: true }),
      closeDialog: () => set({ dialogOpen: false }),
    }),
    {
      name: "tack-ai",
      partialize: (s) => ({ anthropicKey: s.anthropicKey, braveKey: s.braveKey, model: s.model }),
    },
  ),
);

export function aiHeaders(): Record<string, string> {
  const { anthropicKey, braveKey, model } = useAiKeys.getState();
  const h: Record<string, string> = {};
  if (anthropicKey) { h["x-anthropic-key"] = anthropicKey; h["x-ai-model"] = model; }
  if (braveKey) h["x-brave-key"] = braveKey;
  return h;
}

// fetch() for Tack's AI/search API: adds the keys, and opens "Connect AI" when the server needs one.
export async function apiFetch(url: string, init: RequestInit = {}) {
  const res = await fetch(url, { ...init, headers: { ...(init.headers as Record<string, string>), ...aiHeaders() } });
  if (res.status === 401) {
    const d = await res.clone().json().catch(() => ({}));
    if (d?.code === "needs_key") useAiKeys.getState().openDialog();
  }
  return res;
}

export const shortModel = (id: string) => MODEL_CHOICES.find((m) => m.id === id)?.label ?? id;
