"use client";

// Keeps the boards store in step with the signed-in person's account on Supabase.
//
//  - On sign-in, their boards and folders are loaded from the server. Boards made in this
//    browser before signing in are offered for import (or dropped if they belong to someone else).
//  - After that, every change is saved a moment later (debounced). Server rows are the whole
//    board as JSON. Last write wins; there's no merging of simultaneous edits from two devices.
//  - Pictures stored as data: URLs (the extension saves Instagram images that way) are uploaded to
//    the "clips" storage bucket first, so board JSON stays small.
//
// Without Supabase env vars, none of this runs and boards stay in the browser.

import { create } from "zustand";
import type { User } from "@supabase/supabase-js";
import { hasAccounts, supabase } from "./supabase/client";
import { useBoards } from "./store";
import type { Board, Folder, ImageCard } from "./types";

export type SyncStatus = "off" | "loading" | "saved" | "saving" | "error";

type AccountState = {
  user: User | null;
  ready: boolean; // the store holds this account's boards (or accounts are off)
  status: SyncStatus;
  error?: string;
  leftovers: number; // boards from before sign-in, waiting for a decision
};
export const useAccount = create<AccountState>(() => ({ user: null, ready: !hasAccounts, status: "off", leftovers: 0 }));

const LAST_USER_KEY = "tack-user";
const SAVE_DELAY = 1200, RETRY_DELAY = 8000;

// what the server currently has, by reference: a board is "dirty" when the store holds a different object
let synced: { boards: Record<string, Board>; folders: Record<string, Folder> } = { boards: {}, folders: {} };
let leftovers: { boards: Record<string, Board>; folders: Record<string, Folder> } | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let flushing = false, started = false, currentUser: string | null = null;
const failedUploads = new Set<string>();

const boardRow = (b: Board, userId: string) => ({
  id: b.id, user_id: userId, name: b.name, folder_id: b.folderId ?? null, data: b, updated_at: new Date(b.updatedAt).toISOString(),
});
const folderRow = (f: Folder, userId: string) => ({ id: f.id, user_id: userId, name: f.name, created_at: new Date(f.createdAt).toISOString() });

// Call once, in the browser. Safe to call again (does nothing).
export function startSync() {
  const sb = supabase();
  if (!sb || started) return;
  started = true;

  sb.auth.getUser().then(({ data }) => onUser(data.user));
  sb.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") onUser(null);
    else if (session?.user && session.user.id !== currentUser) onUser(session.user);
  });

  useBoards.subscribe(() => { if (currentUser) schedule(); });
  // save right away when the tab is hidden or closed, instead of waiting for the delay
  const now = () => { if (currentUser && timer) { clearTimeout(timer); timer = null; void flush(); } };
  document.addEventListener("visibilitychange", () => { if (document.hidden) now(); });
  window.addEventListener("pagehide", now);
}

async function onUser(user: User | null) {
  useAccount.setState({ user });
  if (!user) {
    currentUser = null;
    synced = { boards: {}, folders: {} };
    useAccount.setState({ ready: true, status: "off", leftovers: 0 });
    return;
  }
  currentUser = user.id;
  useAccount.setState({ ready: false, status: "loading", error: undefined });
  await load(user);
}

async function load(user: User) {
  const sb = supabase()!;
  const local = useBoards.getState();
  let lastUser: string | null = null;
  try { lastUser = localStorage.getItem(LAST_USER_KEY); } catch {}

  const [b, f] = await Promise.all([
    sb.from("boards").select("id, data").eq("user_id", user.id),
    sb.from("folders").select("id, name, created_at").eq("user_id", user.id),
  ]);
  if (b.error || f.error) {
    useAccount.setState({ ready: true, status: "error", error: (b.error || f.error)!.message });
    return;
  }
  const boards: Record<string, Board> = {};
  for (const row of b.data) boards[row.id] = row.data as Board;
  const folders: Record<string, Folder> = {};
  for (const row of f.data) folders[row.id] = { id: row.id, name: row.name, createdAt: Date.parse(row.created_at) };
  synced = { boards: { ...boards }, folders: { ...folders } };

  if (lastUser === user.id) {
    // same person as last time: the browser copy is a cache. Keep anything newer or not yet on the server.
    for (const [id, lb] of Object.entries(local.boards)) if (!boards[id] || lb.updatedAt > boards[id].updatedAt) boards[id] = lb;
    for (const [id, lf] of Object.entries(local.folders ?? {})) if (!folders[id]) folders[id] = lf;
    leftovers = null;
  } else if (!lastUser && Object.keys(local.boards).length) {
    // boards made before accounts existed: ask before moving them into this account
    const lb = Object.fromEntries(Object.entries(local.boards).filter(([id]) => !boards[id]));
    const lf = Object.fromEntries(Object.entries(local.folders ?? {}).filter(([id]) => !folders[id]));
    leftovers = Object.keys(lb).length ? { boards: lb, folders: lf } : null;
  } else {
    leftovers = null; // another account's cache: not ours to keep
  }

  useBoards.setState({ boards, folders });
  try { localStorage.setItem(LAST_USER_KEY, user.id); } catch {}
  useAccount.setState({ ready: true, status: "saved", leftovers: leftovers ? Object.keys(leftovers.boards).length : 0 });
  schedule(); // pushes anything the cache had that the server didn't
}

export function importLeftovers() {
  if (!leftovers) return;
  const { boards, folders } = leftovers;
  leftovers = null;
  useBoards.setState((s) => ({ boards: { ...s.boards, ...boards }, folders: { ...s.folders, ...folders } }));
  useAccount.setState({ leftovers: 0 });
}
export function discardLeftovers() {
  leftovers = null;
  useAccount.setState({ leftovers: 0 });
}

export async function signOut() {
  const sb = supabase();
  if (!sb) return;
  if (timer) { clearTimeout(timer); timer = null; }
  await flush();
  await sb.auth.signOut();
  useBoards.setState({ boards: {}, folders: {} }); // don't leave this person's boards for the next one
  try { localStorage.removeItem(LAST_USER_KEY); } catch {}
  location.href = "/";
}

function schedule(delay = SAVE_DELAY) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; void flush(); }, delay);
}

async function flush() {
  const sb = supabase();
  const userId = currentUser;
  if (!sb || !userId || flushing) { if (flushing) schedule(); return; }
  const s = useBoards.getState();

  const dirtyBoards = Object.values(s.boards).filter((b) => synced.boards[b.id] !== b);
  const goneBoards = Object.keys(synced.boards).filter((id) => !s.boards[id]);
  const dirtyFolders = Object.values(s.folders ?? {}).filter((f) => synced.folders[f.id] !== f);
  const goneFolders = Object.keys(synced.folders).filter((id) => !s.folders?.[id]);
  if (!dirtyBoards.length && !goneBoards.length && !dirtyFolders.length && !goneFolders.length) {
    useAccount.setState({ status: "saved" });
    return;
  }

  flushing = true;
  useAccount.setState({ status: "saving" });
  try {
    // pictures saved as data: URLs go to storage first; that edits the store, which schedules another save
    if (await uploadInlineImages(dirtyBoards, userId)) { flushing = false; schedule(300); return; }

    const ops: PromiseLike<{ error: { message: string } | null }>[] = [];
    if (dirtyFolders.length) ops.push(sb.from("folders").upsert(dirtyFolders.map((f) => folderRow(f, userId))));
    if (dirtyBoards.length) ops.push(sb.from("boards").upsert(dirtyBoards.map((b) => boardRow(b, userId))));
    if (goneBoards.length) ops.push(sb.from("boards").delete().in("id", goneBoards));
    if (goneFolders.length) ops.push(sb.from("folders").delete().in("id", goneFolders));
    const results = await Promise.all(ops);
    const failed = results.find((r) => r.error);
    if (failed) throw new Error(failed.error!.message);

    for (const b of dirtyBoards) synced.boards[b.id] = b;
    for (const id of goneBoards) delete synced.boards[id];
    for (const f of dirtyFolders) synced.folders[f.id] = f;
    for (const id of goneFolders) delete synced.folders[id];
    useAccount.setState({ status: "saved", error: undefined });
  } catch (e) {
    useAccount.setState({ status: "error", error: e instanceof Error ? e.message : "Couldn't save." });
    schedule(RETRY_DELAY);
  } finally {
    flushing = false;
    // changes made while saving
    if (userId === currentUser && Object.values(useBoards.getState().boards).some((b) => synced.boards[b.id] !== b)) schedule();
  }
}

// Upload data: images in these boards to storage and point the cards at the uploaded files.
// Returns true when something was changed in the store.
async function uploadInlineImages(boards: Board[], userId: string): Promise<boolean> {
  const sb = supabase()!;
  let changed = false;
  for (const b of boards) for (const p of b.pages) for (const c of p.cards) {
    if (c.kind !== "image" || failedUploads.has(c.id)) continue;
    const patch: Partial<ImageCard> = {};
    for (const key of ["src", "fallbackSrc"] as const) {
      const v = c[key];
      if (!v || !v.startsWith("data:")) continue;
      try {
        const blob = await (await fetch(v)).blob();
        const ext = blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : "jpg";
        const path = `${userId}/${c.id}${key === "fallbackSrc" ? "-small" : ""}.${ext}`;
        const { error } = await sb.storage.from("clips").upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: true });
        if (error) throw error;
        patch[key] = sb.storage.from("clips").getPublicUrl(path).data.publicUrl;
      } catch {
        failedUploads.add(c.id); // keep the data: URL in the board instead of trying forever
      }
    }
    if (Object.keys(patch).length) {
      useBoards.getState().updateCard(b.id, p.id, c.id, patch);
      changed = true;
    }
  }
  return changed;
}
