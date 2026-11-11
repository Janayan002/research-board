"use client";

// All boards live in one Zustand store, saved to the browser's localStorage.
// Later (accounts + credits), this is the layer you'd swap for Supabase.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useEffect, useState } from "react";
import type { Board, Card, Candidate, Folder, Frame, Page, ResearchSession, Viewport } from "./types";

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

type State = {
  boards: Record<string, Board>;
  folders: Record<string, Folder>;
  // boards
  createBoard: (name: string, frame: Frame, folderId?: string) => string;
  moveBoardToFolder: (id: string, folderId: string | undefined) => void;
  // folders
  createFolder: (name: string) => string;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void; // its boards move out, they aren't deleted
  deleteBoard: (id: string) => void;
  renameBoard: (id: string, name: string) => void;
  // undo / redo of a board's pages and cards (Cmd+Z / Cmd+Shift+Z)
  undo: (boardId: string) => boolean;
  redo: (boardId: string) => boolean;
  // pages
  addPage: (boardId: string) => string;
  renamePage: (boardId: string, pageId: string, name: string) => void;
  deletePage: (boardId: string, pageId: string) => void;
  duplicatePage: (boardId: string, pageId: string) => string;
  movePage: (boardId: string, from: number, to: number) => void;
  setCurrentPage: (boardId: string, pageId: string) => void;
  setViewport: (boardId: string, viewport: Viewport) => void;
  // cards (always on a page)
  addCard: (boardId: string, pageId: string, card: Card) => void;
  updateCard: (boardId: string, pageId: string, cardId: string, patch: Partial<Card>) => void;
  removeCard: (boardId: string, pageId: string, cardId: string) => void;
  bringToFront: (boardId: string, pageId: string, cardId: string) => void;
  moveCard: (boardId: string, fromPageId: string, toPageId: string, cardId: string, patch?: Partial<Card>) => void;
  // research (shared by all pages of a board)
  addSession: (boardId: string, session: ResearchSession) => void;
  removeSession: (boardId: string, sessionId: string) => void;
  updateCandidate: (boardId: string, sessionId: string, candId: string, patch: Partial<Candidate>) => void;
  appendCandidates: (boardId: string, sessionId: string, cands: Candidate[]) => void;
};

// helpers: change one board / one page immutably
const patchBoard = (s: State, id: string, fn: (b: Board) => Partial<Board>, touch = true) => {
  const b = s.boards[id];
  if (!b) return s;
  return { boards: { ...s.boards, [id]: { ...b, ...fn(b), ...(touch ? { updatedAt: Date.now() } : {}) } } };
};
const patchPage = (s: State, boardId: string, pageId: string, fn: (p: Page) => Partial<Page>, touch = true) =>
  patchBoard(s, boardId, (b) => ({ pages: b.pages.map((p) => (p.id === pageId ? { ...p, ...fn(p) } : p)) }), touch);

const newPage = (name: string): Page => ({ id: uid(), name, cards: [] });

// the next free "Page N" name
const nextPageName = (b: Board) => {
  let n = b.pages.length + 1;
  while (b.pages.some((p) => p.name === `Page ${n}`)) n++;
  return `Page ${n}`;
};

export const currentPage = (b: Board): Page => b.pages.find((p) => p.id === b.currentPageId) ?? b.pages[0];

// ---- undo history ----
// Kept in memory only (not saved), per board. We snapshot a board's pages before each change to them.
// Changes that come in a quick burst (typing, a multi-card move) collapse into one undo step.
const UNDO_LIMIT = 100, BURST_MS = 700;
const history: Record<string, { past: Page[][]; future: Page[][]; last: number }> = {};
const hist = (id: string) => (history[id] ??= { past: [], future: [], last: 0 });
let applyingHistory = false;

export const useBoards = create<State>()(
  persist(
    (rawSet, get) => {
      type Next = Partial<State> | ((s: State) => Partial<State>);
      // every change goes through here; it records the old pages of any board whose pages changed
      const set = (next: Next) =>
        rawSet((s) => {
          const out = typeof next === "function" ? next(s) : next;
          if (!applyingHistory && out.boards) {
            const now = Date.now();
            for (const [id, b] of Object.entries(out.boards)) {
              const before = s.boards[id];
              if (!before || before.pages === b.pages) continue;
              const h = hist(id);
              if (now - h.last > BURST_MS) {
                h.past.push(before.pages);
                if (h.past.length > UNDO_LIMIT) h.past.shift();
              }
              h.last = now;
              h.future = [];
            }
          }
          return out;
        });
      const restore = (boardId: string, from: "past" | "future") => {
        const h = hist(boardId);
        const b = get().boards[boardId];
        const pages = h[from].pop();
        if (!b || !pages) return false;
        (from === "past" ? h.future : h.past).push(b.pages);
        h.last = 0; // the next edit starts a new step
        applyingHistory = true;
        const currentPageId = pages.some((p) => p.id === b.currentPageId) ? b.currentPageId : pages[0]?.id;
        rawSet((s) => ({ boards: { ...s.boards, [boardId]: { ...b, pages, currentPageId, updatedAt: Date.now() } } }));
        applyingHistory = false;
        return true;
      };
      return {
      boards: {},
      folders: {},

      undo: (boardId) => restore(boardId, "past"),
      redo: (boardId) => restore(boardId, "future"),

      createBoard: (name, frame, folderId) => {
        const id = uid();
        const now = Date.now();
        const first = newPage("Page 1");
        set((s) => ({
          boards: {
            ...s.boards,
            [id]: { id, name, folderId, frame, pages: [first], currentPageId: first.id, research: [], createdAt: now, updatedAt: now },
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

      // filing a board doesn't count as editing it
      moveBoardToFolder: (id, folderId) => set((s) => patchBoard(s, id, () => ({ folderId }), false)),

      createFolder: (name) => {
        const id = uid();
        set((s) => ({ folders: { ...s.folders, [id]: { id, name, createdAt: Date.now() } } }));
        return id;
      },

      renameFolder: (id, name) =>
        set((s) => (s.folders[id] ? { folders: { ...s.folders, [id]: { ...s.folders[id], name } } } : s)),

      deleteFolder: (id) =>
        set((s) => {
          const { [id]: _, ...folders } = s.folders;
          const boards = Object.fromEntries(
            Object.entries(s.boards).map(([k, b]) => [k, b.folderId === id ? { ...b, folderId: undefined } : b])
          );
          return { folders, boards };
        }),

      addPage: (boardId) => {
        const b = get().boards[boardId];
        if (!b) return "";
        const page = newPage(nextPageName(b));
        set((s) => patchBoard(s, boardId, (b) => ({ pages: [...b.pages, page], currentPageId: page.id })));
        return page.id;
      },

      renamePage: (boardId, pageId, name) => set((s) => patchPage(s, boardId, pageId, () => ({ name }))),

      deletePage: (boardId, pageId) =>
        set((s) =>
          patchBoard(s, boardId, (b) => {
            if (b.pages.length <= 1) return {}; // a board always keeps one page
            const i = b.pages.findIndex((p) => p.id === pageId);
            const pages = b.pages.filter((p) => p.id !== pageId);
            const current = b.currentPageId === pageId ? pages[Math.max(0, i - 1)].id : b.currentPageId;
            return { pages, currentPageId: current };
          })
        ),

      duplicatePage: (boardId, pageId) => {
        const b = get().boards[boardId];
        const src = b?.pages.find((p) => p.id === pageId);
        if (!b || !src) return "";
        const copy: Page = { ...src, id: uid(), name: `${src.name} copy`, cards: src.cards.map((c) => ({ ...c, id: uid() })) };
        set((s) =>
          patchBoard(s, boardId, (b) => {
            const i = b.pages.findIndex((p) => p.id === pageId);
            const pages = [...b.pages];
            pages.splice(i + 1, 0, copy);
            return { pages, currentPageId: copy.id };
          })
        );
        return copy.id;
      },

      movePage: (boardId, from, to) =>
        set((s) =>
          patchBoard(s, boardId, (b) => {
            if (from === to || from < 0 || to < 0 || from >= b.pages.length || to >= b.pages.length) return {};
            const pages = [...b.pages];
            const [p] = pages.splice(from, 1);
            pages.splice(to, 0, p);
            return { pages };
          })
        ),

      setCurrentPage: (boardId, pageId) => set((s) => patchBoard(s, boardId, () => ({ currentPageId: pageId }), false)),

      // viewport changes constantly, so don't bump updatedAt for it
      setViewport: (boardId, viewport) => set((s) => patchBoard(s, boardId, () => ({ viewport }), false)),

      addCard: (boardId, pageId, card) => set((s) => patchPage(s, boardId, pageId, (p) => ({ cards: [...p.cards, card] }))),

      updateCard: (boardId, pageId, cardId, patch) =>
        set((s) =>
          patchPage(s, boardId, pageId, (p) => ({
            cards: p.cards.map((c) => (c.id === cardId ? ({ ...c, ...patch } as Card) : c)),
          }))
        ),

      removeCard: (boardId, pageId, cardId) =>
        set((s) => patchPage(s, boardId, pageId, (p) => ({ cards: p.cards.filter((c) => c.id !== cardId) }))),

      // last item in the array is drawn on top
      bringToFront: (boardId, pageId, cardId) =>
        set((s) =>
          patchPage(s, boardId, pageId, (p) => {
            const card = p.cards.find((c) => c.id === cardId);
            if (!card || p.cards[p.cards.length - 1]?.id === cardId) return {};
            return { cards: [...p.cards.filter((c) => c.id !== cardId), card] };
          })
        ),

      // drag a card from one page onto another
      moveCard: (boardId, fromPageId, toPageId, cardId, patch = {}) =>
        set((s) =>
          patchBoard(s, boardId, (b) => {
            const card = b.pages.find((p) => p.id === fromPageId)?.cards.find((c) => c.id === cardId);
            if (!card) return {};
            return {
              pages: b.pages.map((p) =>
                p.id === fromPageId ? { ...p, cards: p.cards.filter((c) => c.id !== cardId) }
                : p.id === toPageId ? { ...p, cards: [...p.cards, { ...card, ...patch } as Card] }
                : p),
            };
          })
        ),

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
      };
    },
    {
      name: "research-board-v1",
      version: 4,
      migrate: (persisted: any, version) => {
        // v1 boards had cards directly on the board — move them onto "Page 1"
        if (version < 2 && persisted?.boards) {
          for (const b of Object.values<any>(persisted.boards)) {
            if (!b.pages) {
              const page = { id: uid(), name: "Page 1", cards: b.cards ?? [], viewport: b.viewport };
              b.pages = [page];
              b.currentPageId = page.id;
              delete b.cards;
              delete b.viewport;
            }
          }
        }
        // v1/v2: "artist" cards became general "research" cards
        if (version < 3 && persisted?.boards) {
          for (const b of Object.values<any>(persisted.boards)) {
            for (const p of b.pages ?? []) for (const c of p.cards ?? []) if (c.kind === "artist") { c.kind = "research"; c.category = "artist"; }
            for (const r of b.research ?? []) r.type = r.type ?? "artist";
          }
        }
        // v1–v3: sticky notes became text boxes (kept in the handwriting font they used)
        if (version < 4 && persisted?.boards) {
          for (const b of Object.values<any>(persisted.boards))
            for (const p of b.pages ?? []) for (const c of p.cards ?? [])
              if (c.kind === "note") { c.kind = "text"; c.font = "Caveat"; c.size = 24; c.color = "#1e1e1e"; }
        }
        return persisted;
      },
    }
  )
);

// localStorage only exists in the browser, so wait until mounted before rendering saved data
export function useHydrated() {
  const [ok, setOk] = useState(false);
  useEffect(() => setOk(true), []);
  return ok;
}
