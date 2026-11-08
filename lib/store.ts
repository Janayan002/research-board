"use client";

// All boards live in one Zustand store, saved to the browser's localStorage.
// Later (accounts + credits), this is the layer you'd swap for Supabase.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useEffect, useState } from "react";
import type { Board, Card, Candidate, Frame, ResearchSession, Viewport } from "./types";

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

type State = {
  boards: Record<string, Board>;
  createBoard: (name: string, frame: Frame) => string;
  deleteBoard: (id: string) => void;
  renameBoard: (id: string, name: string) => void;
  addCard: (boardId: string, card: Card) => void;
  updateCard: (boardId: string, cardId: string, patch: Partial<Card>) => void;
  removeCard: (boardId: string, cardId: string) => void;
  bringToFront: (boardId: string, cardId: string) => void;
  setViewport: (boardId: string, viewport: Viewport) => void;
  addSession: (boardId: string, session: ResearchSession) => void;
  removeSession: (boardId: string, sessionId: string) => void;
  updateCandidate: (boardId: string, sessionId: string, candId: string, patch: Partial<Candidate>) => void;
  appendCandidates: (boardId: string, sessionId: string, cands: Candidate[]) => void;
};

// helper: change one board immutably
const patchBoard = (s: State, id: string, fn: (b: Board) => Partial<Board>) => {
  const b = s.boards[id];
  if (!b) return s;
  return { boards: { ...s.boards, [id]: { ...b, ...fn(b), updatedAt: Date.now() } } };
};

export const useBoards = create<State>()(
  persist(
    (set) => ({
      boards: {},

      createBoard: (name, frame) => {
        const id = uid();
        const now = Date.now();
        set((s) => ({
          boards: {
            ...s.boards,
            [id]: { id, name, frame, cards: [], research: [], createdAt: now, updatedAt: now },
          },
        }));
        return id;
      },

      deleteBoard: (id) =>
        set((s) => {
          const { [id]: _, ...rest } = s.boards;
          return { boards: rest };
        }),

      renameBoard: (id, name) => set((s) => patchBoard(s, id, () => ({ name }))),

      addCard: (boardId, card) => set((s) => patchBoard(s, boardId, (b) => ({ cards: [...b.cards, card] }))),

      updateCard: (boardId, cardId, patch) =>
        set((s) =>
          patchBoard(s, boardId, (b) => ({
            cards: b.cards.map((c) => (c.id === cardId ? ({ ...c, ...patch } as Card) : c)),
          }))
        ),

      removeCard: (boardId, cardId) =>
        set((s) => patchBoard(s, boardId, (b) => ({ cards: b.cards.filter((c) => c.id !== cardId) }))),

      // last item in the array is drawn on top
      bringToFront: (boardId, cardId) =>
        set((s) =>
          patchBoard(s, boardId, (b) => {
            const card = b.cards.find((c) => c.id === cardId);
            if (!card || b.cards[b.cards.length - 1]?.id === cardId) return {};
            return { cards: [...b.cards.filter((c) => c.id !== cardId), card] };
          })
        ),

      // viewport changes constantly, so don't bump updatedAt for it
      setViewport: (boardId, viewport) =>
        set((s) => {
          const b = s.boards[boardId];
          if (!b) return s;
          return { boards: { ...s.boards, [boardId]: { ...b, viewport } } };
        }),

      addSession: (boardId, session) =>
        set((s) => patchBoard(s, boardId, (b) => ({ research: [session, ...b.research] }))),

      removeSession: (boardId, sessionId) =>
        set((s) => patchBoard(s, boardId, (b) => ({ research: b.research.filter((r) => r.id !== sessionId) }))),

      updateCandidate: (boardId, sessionId, candId, patch) =>
        set((s) =>
          patchBoard(s, boardId, (b) => ({
            research: b.research.map((r) =>
              r.id !== sessionId
                ? r
                : { ...r, candidates: r.candidates.map((c) => (c.id === candId ? { ...c, ...patch } : c)) }
            ),
          }))
        ),

      appendCandidates: (boardId, sessionId, cands) =>
        set((s) =>
          patchBoard(s, boardId, (b) => ({
            research: b.research.map((r) => (r.id !== sessionId ? r : { ...r, candidates: [...r.candidates, ...cands] })),
          }))
        ),
    }),
    { name: "research-board-v1" }
  )
);

// localStorage only exists in the browser, so wait until mounted before rendering saved data
export function useHydrated() {
  const [ok, setOk] = useState(false);
  useEffect(() => setOk(true), []);
  return ok;
}
