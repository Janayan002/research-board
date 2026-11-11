"use client";

// Home: recent boards in the main area, folders in the sidebar, "New board" top right (like Figma's file browser).

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PRESETS } from "@/lib/presets";
import { useBoards, useHydrated } from "@/lib/store";
import type { Board } from "@/lib/types";
import { ConnectAIButton } from "@/components/ConnectAI";
import { useHasExtension } from "@/lib/extension";
import { discardLeftovers, importLeftovers, signOut, useAccount } from "@/lib/sync";
import { hasAccounts } from "@/lib/supabase/client";
import Link from "next/link";
import { IconClose, IconFolder, IconMore, IconPencil, IconPlus, IconSearch, IconTack, IconTrash } from "@/components/Icons";

type View = { kind: "recents" } | { kind: "folders" } | { kind: "folder"; id: string };

const BOARD_MIME = "application/x-board";

export default function Home() {
  const router = useRouter();
  const hydrated = useHydrated();
  const hasExtension = useHasExtension();
  const account = useAccount();
  const boards = useBoards((s) => s.boards);
  const folders = useBoards((s) => s.folders) ?? {};
  const createFolder = useBoards((s) => s.createFolder);
  const renameFolder = useBoards((s) => s.renameFolder);
  const deleteFolder = useBoards((s) => s.deleteFolder);
  const moveBoardToFolder = useBoards((s) => s.moveBoardToFolder);

  const [view, setViewState] = useState<View>({ kind: "recents" });
  const [query, setQuery] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [confirmDelFolder, setConfirmDelFolder] = useState<string | null>(null);
  const [dropFolder, setDropFolder] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  // remember which view you were on (per tab)
  useEffect(() => {
    try { const v = JSON.parse(sessionStorage.getItem("home-view") || "null"); if (v?.kind) setViewState(v); } catch {}
  }, []);
  const setView = (v: View) => { setViewState(v); setQuery(""); try { sessionStorage.setItem("home-view", JSON.stringify(v)); } catch {} };

  const folderList = hydrated ? Object.values(folders).sort((a, b) => a.name.localeCompare(b.name)) : [];
  const allBoards = hydrated ? Object.values(boards).sort((a, b) => b.updatedAt - a.updatedAt) : [];
  const currentFolder = view.kind === "folder" ? folders[view.id] : undefined;
  // a folder that no longer exists: fall back to recents
  useEffect(() => { if (hydrated && view.kind === "folder" && !folders[view.id]) setView({ kind: "recents" }); }); // eslint-disable-line react-hooks/exhaustive-deps

  const q = query.trim().toLowerCase();
  const shown = allBoards
    .filter((b) => view.kind !== "folder" || b.folderId === view.id)
    .filter((b) => !q || b.name.toLowerCase().includes(q));

  const countIn = (fid: string) => allBoards.filter((b) => b.folderId === fid).length;

  const newFolder = () => {
    const id = createFolder(nextFolderName(folderList.map((f) => f.name)));
    setView({ kind: "folder", id });
    setRenamingFolder(id);
    return id;
  };

  // drop a dragged board onto a folder
  const dropProps = (fid: string) => ({
    onDragOver: (e: React.DragEvent) => { if (e.dataTransfer.types.includes(BOARD_MIME)) { e.preventDefault(); setDropFolder(fid); } },
    onDragLeave: () => setDropFolder((d) => (d === fid ? null : d)),
    onDrop: (e: React.DragEvent) => {
      const id = e.dataTransfer.getData(BOARD_MIME);
      if (id) { e.preventDefault(); moveBoardToFolder(id, fid); }
      setDropFolder(null);
    },
  });

  const title = view.kind === "recents" ? "Recents" : view.kind === "folders" ? "All folders" : currentFolder?.name ?? "";

  return (
    <div className="home">
      <header className="home-head">
        <div className="home-head-row">
          <button className="wordmark" onClick={() => setView({ kind: "recents" })} aria-label="Tack home">Tack</button>
          <nav className="pipe-nav" aria-label="Main">
            <button className={view.kind === "recents" ? "on" : ""} onClick={() => setView({ kind: "recents" })}>Recents</button>
            <button className={view.kind === "folders" || view.kind === "folder" ? "on" : ""} onClick={() => setView({ kind: "folders" })}>Folders</button>
            <Link href="/extension">{hasExtension ? "Clipper installed" : "Browser extension"}</Link>
            <ConnectAIButton />
            {account.user ? <button onClick={() => signOut()} title={account.user.email}>Sign out</button>
              : hasAccounts ? <Link href="/login">Sign in</Link> : null}
          </nav>
        </div>
        <p className="home-line">
          Tack keeps images, links and notes on research boards. Every image keeps its source and the day you found it.
          {hasAccounts && <SyncWord />}
        </p>
      </header>

      <div className="home-body">
      <aside className="home-side">
        <label className="home-search">
          <IconSearch size={16} />
          <input placeholder="Search boards" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search boards" />
        </label>

        <div className="home-side-head">
          <span>Folders</span>
          <button className="icon-btn" style={{ width: 26, height: 26 }} title="New folder" aria-label="New folder" onClick={newFolder}><IconPlus size={15} /></button>
        </div>
        <div className="home-folders">
          {folderList.map((f) => (
            <div
              key={f.id}
              className={`home-nav-item folder ${view.kind === "folder" && view.id === f.id ? "on" : ""} ${dropFolder === f.id ? "drop" : ""}`}
              onClick={() => setView({ kind: "folder", id: f.id })}
              onDoubleClick={() => setRenamingFolder(f.id)}
              {...dropProps(f.id)}
            >
              <IconFolder size={18} />
              {renamingFolder === f.id ? (
                <input
                  autoFocus
                  className="page-rename"
                  defaultValue={f.name}
                  onFocus={(e) => e.target.select()}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => { renameFolder(f.id, e.target.value.trim() || f.name); setRenamingFolder(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setRenamingFolder(null); }}
                />
              ) : (
                <>
                  <span className="home-nav-name">{f.name}</span>
                  <span className="home-nav-count">{countIn(f.id) || ""}</span>
                </>
              )}
            </div>
          ))}
          {hydrated && folderList.length === 0 && (
            <button className="home-side-hint" onClick={newFolder}>
              {dragging ? "Make a folder first, then drag boards onto it" : "+ New folder"}
            </button>
          )}
        </div>
      </aside>

      <main className="home-main">
        <header className="home-top">
          <div className="home-crumb">
            {view.kind === "folder" && (
              <>
                <button className="crumb-link" onClick={() => setView({ kind: "folders" })}>All folders</button>
                <span className="muted">/</span>
              </>
            )}
            <h1>{title}</h1>
            {view.kind === "folder" && currentFolder && (
              <span className="crumb-actions">
                <button className="icon-btn" style={{ width: 28, height: 28 }} title="Rename folder" aria-label="Rename folder" onClick={() => setRenamingFolder(currentFolder.id)}><IconPencil size={15} /></button>
                <button
                  className={`icon-btn ${confirmDelFolder === currentFolder.id ? "danger" : ""}`}
                  style={{ width: confirmDelFolder === currentFolder.id ? "auto" : 28, height: 28, padding: confirmDelFolder === currentFolder.id ? "0 8px" : 0 }}
                  title="Delete folder (boards inside are kept)"
                  aria-label="Delete folder"
                  onClick={() => {
                    if (confirmDelFolder === currentFolder.id) { deleteFolder(currentFolder.id); setConfirmDelFolder(null); setView({ kind: "folders" }); }
                    else { setConfirmDelFolder(currentFolder.id); setTimeout(() => setConfirmDelFolder(null), 3000); }
                  }}
                >
                  {confirmDelFolder === currentFolder.id ? "Delete folder? Boards are kept" : <IconTrash size={15} />}
                </button>
              </span>
            )}
          </div>
          <div className="home-top-actions">
            <button className="btn" onClick={newFolder}><IconFolder size={15} /> New folder</button>
            <button className="btn primary" onClick={() => setShowNew(true)}><IconPlus size={15} /> New board</button>
          </div>
        </header>

        <div className="home-content">
          {account.leftovers > 0 && (
            <div className="import-bar" role="status">
              <span>
                {account.leftovers === 1 ? "There's a board" : `There are ${account.leftovers} boards`} in this browser from before you signed in.
                Move {account.leftovers === 1 ? "it" : "them"} into your account?
              </span>
              <button className="btn small primary" onClick={importLeftovers}>Move to my account</button>
              <button className="btn small ghost" onClick={discardLeftovers}>Discard {account.leftovers === 1 ? "it" : "them"}</button>
            </div>
          )}
          {!hydrated || !account.ready ? null : view.kind === "folders" ? (
            folderList.length === 0 ? (
              <div className="empty">
                No folders yet. <button className="crumb-link" onClick={newFolder}>Make one</button>, then drag boards onto it or use a board’s ⋯ menu.
              </div>
            ) : (
              <div className="board-grid">
                {folderList.filter((f) => !q || f.name.toLowerCase().includes(q)).map((f) => {
                  const inside = allBoards.filter((b) => b.folderId === f.id);
                  return (
                    <div key={f.id} className={`board-tile folder-tile ${dropFolder === f.id ? "drop" : ""}`} onClick={() => setView({ kind: "folder", id: f.id })} {...dropProps(f.id)}>
                      <div className="board-tile-thumb folder-thumb">
                        {inside.slice(0, 4).map((b) => <div key={b.id} className="folder-mini"><BoardThumb board={b} /></div>)}
                        {inside.length === 0 && <span className="muted" style={{ fontSize: 12 }}>Empty — drag boards here</span>}
                      </div>
                      <div className="board-tile-meta">
                        <span className="tile-icon"><IconFolder size={16} /></span>
                        <div style={{ minWidth: 0 }}>
                          <div className="board-tile-name">{f.name}</div>
                          <div className="board-tile-sub">{inside.length} board{inside.length === 1 ? "" : "s"}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : shown.length === 0 ? (
            <div className="empty">
              {q ? <>No boards match “{query}”.</>
                : view.kind === "folder" ? <>This folder is empty. Drag boards onto it in the sidebar, or <button className="crumb-link" onClick={() => setShowNew(true)}>make a new board here</button>.</>
                : <>No boards yet. <button className="crumb-link" onClick={() => setShowNew(true)}>Create your first board</button>.</>}
            </div>
          ) : (
            <div className="board-grid">
              {shown.map((b) => (
                <BoardTile
                  key={b.id}
                  board={b}
                  folderName={view.kind === "recents" && b.folderId ? folders[b.folderId]?.name : undefined}
                  folders={folderList}
                  onOpen={() => router.push(`/board/${b.id}`)}
                  onNewFolder={() => { const id = createFolder(nextFolderName(folderList.map((f) => f.name))); moveBoardToFolder(b.id, id); setRenamingFolder(id); }}
                  onDragState={setDragging}
                />
              ))}
            </div>
          )}
        </div>
      </main>
      </div>

      {showNew && (
        <NewBoardDialog
          folderId={view.kind === "folder" ? view.id : undefined}
          folderName={currentFolder?.name}
          onClose={() => setShowNew(false)}
          onCreated={(id) => router.push(`/board/${id}`)}
        />
      )}
    </div>
  );
}

// a few words at the end of the header line: where your boards are being saved
function SyncWord() {
  const { user, status, error } = useAccount();
  if (!user) return <span className="sync-word off"> Boards stay in this browser. <Link href="/login">Sign in</Link> to keep them in an account.</span>;
  const text = status === "saving" ? "Saving…" : status === "loading" ? "Loading your boards…" : status === "error" ? `Couldn't save: ${error}` : "Saved to your account.";
  return <span className={`sync-word ${status}`}> {text}</span>;
}

const nextFolderName = (names: string[]) => {
  if (!names.includes("New folder")) return "New folder";
  let n = 2;
  while (names.includes(`New folder ${n}`)) n++;
  return `New folder ${n}`;
};

// ---------- a board in the grid, with its ⋯ menu ----------
function BoardTile({ board, folderName, folders, onOpen, onNewFolder, onDragState }: {
  board: Board;
  folderName?: string;
  folders: { id: string; name: string }[];
  onOpen: () => void;
  onNewFolder: () => void;
  onDragState: (d: boolean) => void;
}) {
  const renameBoard = useBoards((s) => s.renameBoard);
  const deleteBoard = useBoards((s) => s.deleteBoard);
  const moveBoardToFolder = useBoards((s) => s.moveBoardToFolder);
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // close the menu when clicking anywhere else
  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => { if (!menuRef.current?.contains(e.target as Node)) { setMenu(false); setConfirmDel(false); } };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", esc); };
  }, [menu]);

  const items = board.pages.reduce((n, p) => n + p.cards.length, 0);

  return (
    <div
      className={`board-tile ${menu ? "menu-open" : ""}`}
      onClick={() => !renaming && onOpen()}
      draggable={!renaming}
      onDragStart={(e) => { e.dataTransfer.setData(BOARD_MIME, board.id); e.dataTransfer.effectAllowed = "move"; onDragState(true); }}
      onDragEnd={() => onDragState(false)}
    >
      <div className="board-tile-thumb"><BoardThumb board={board} /></div>
      <div className="board-tile-meta">
        <span className="tile-icon"><span className="home-logo sm" aria-hidden><IconTack size={12} /></span></span>
        <div style={{ minWidth: 0, flex: 1 }}>
          {renaming ? (
            <input
              autoFocus
              className="page-rename"
              style={{ width: "100%" }}
              defaultValue={board.name}
              onFocus={(e) => e.target.select()}
              onClick={(e) => e.stopPropagation()}
              onBlur={(e) => { renameBoard(board.id, e.target.value.trim() || board.name); setRenaming(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setRenaming(false); }}
            />
          ) : (
            <div className="board-tile-name" title={board.name}>{board.name}</div>
          )}
          <div className="board-tile-sub">
            Edited {timeAgo(board.updatedAt)} · {board.pages.length} page{board.pages.length === 1 ? "" : "s"} · {items} item{items === 1 ? "" : "s"}
            {folderName && <> · <IconFolder size={11} /> {folderName}</>}
          </div>
        </div>
        <div className="tile-menu-wrap" ref={menuRef} onClick={(e) => e.stopPropagation()}>
          <button className="icon-btn tile-more" aria-label="Board options" aria-expanded={menu} onClick={() => setMenu((m) => !m)}><IconMore size={18} /></button>
          {menu && (
            <div className="tile-menu" role="menu">
              <button role="menuitem" onClick={() => { setMenu(false); onOpen(); }}>Open</button>
              <button role="menuitem" onClick={() => { setMenu(false); setRenaming(true); }}>Rename</button>
              <div className="tile-menu-sep" />
              <div className="tile-menu-label">Move to folder</div>
              {folders.map((f) => (
                <button key={f.id} role="menuitemradio" aria-checked={board.folderId === f.id} className={board.folderId === f.id ? "on" : ""}
                  onClick={() => { moveBoardToFolder(board.id, f.id); setMenu(false); }}>
                  <IconFolder size={14} /> {f.name}
                </button>
              ))}
              <button role="menuitem" onClick={() => { setMenu(false); onNewFolder(); }}><IconPlus size={14} /> New folder</button>
              {board.folderId && (
                <button role="menuitem" onClick={() => { moveBoardToFolder(board.id, undefined); setMenu(false); }}><IconClose size={14} /> Remove from folder</button>
              )}
              <div className="tile-menu-sep" />
              <button role="menuitem" className="danger" onClick={() => (confirmDel ? deleteBoard(board.id) : setConfirmDel(true))}>
                <IconTrash size={14} /> {confirmDel ? "Click again to delete" : "Delete board"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- new board: frame size presets ----------
function NewBoardDialog({ folderId, folderName, onClose, onCreated }: { folderId?: string; folderName?: string; onClose: () => void; onCreated: (id: string) => void }) {
  const createBoard = useBoards((s) => s.createBoard);
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const [name, setName] = useState("");
  const [w, setW] = useState(PRESETS[0].w);
  const [h, setH] = useState(PRESETS[0].h);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const pick = (id: string) => {
    const p = PRESETS.find((x) => x.id === id);
    setPresetId(id);
    if (p) { setW(p.w); setH(p.h); }
  };

  const create = () => {
    const width = Math.max(100, Math.min(20000, Math.round(w || 0)));
    const height = Math.max(100, Math.min(20000, Math.round(h || 0)));
    onCreated(createBoard(name.trim() || "Untitled research", { w: width, h: height, preset: presetId }, folderId));
  };

  return (
    <div className="modal-backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 820 }} role="dialog" aria-label="New board">
        <div className="modal-head">
          <div className="t"><IconPlus size={18} /> New board{folderName && <span className="muted" style={{ fontWeight: 400 }}>in {folderName}</span>}</div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><IconClose size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="label" style={{ marginBottom: 10 }}>Frame size</div>
          <div className="preset-grid">
            {PRESETS.map((p) => (
              <button key={p.id} className={`preset ${presetId === p.id ? "selected" : ""}`} onClick={() => pick(p.id)}>
                <div className="preset-thumb"><Thumb w={p.w} h={p.h} /></div>
                <div>
                  <div className="preset-name">{p.label}</div>
                  <div className="preset-size">{p.w} × {p.h}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="modal-foot new-bar">
          <div className="field grow">
            <span className="label">Board name</span>
            <input autoFocus className="input" placeholder="e.g. Bus stations — sculpture references" value={name}
              onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} />
          </div>
          <div className="field">
            <span className="label">Width</span>
            <input className="input" style={{ width: 90 }} type="number" value={w} onChange={(e) => { setW(Number(e.target.value)); setPresetId("custom"); }} />
          </div>
          <div className="field">
            <span className="label">Height</span>
            <input className="input" style={{ width: 90 }} type="number" value={h} onChange={(e) => { setH(Number(e.target.value)); setPresetId("custom"); }} />
          </div>
          <button className="btn primary" style={{ height: 32 }} onClick={create}>Create board</button>
        </div>
      </div>
    </div>
  );
}

function Thumb({ w, h }: { w: number; h: number }) {
  const max = 56;
  const s = max / Math.max(w, h);
  return <div style={{ width: w * s, height: h * s }} />;
}

// preview of a board's first page: the frame, with images shown and other cards as blocks
function BoardThumb({ board }: { board: Board }) {
  const { frame } = board;
  const cards = board.pages[0]?.cards ?? [];
  const height = (c: Board["pages"][number]["cards"][number]) =>
    c.kind === "text" ? Math.max(10, c.size * 1.3) : c.kind === "link" ? 80 : c.kind === "image" ? c.w * 0.75 : 320;
  let minX = 0, minY = 0, maxX = frame.w, maxY = frame.h;
  for (const c of cards) {
    const sc = c.scale ?? 1;
    minX = Math.min(minX, c.x); minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x + c.w * sc); maxY = Math.max(maxY, c.y + height(c) * sc);
  }
  const W = maxX - minX, H = maxY - minY;
  const s = Math.min(330 / W, 168 / H);
  return (
    <div style={{ position: "relative", width: W * s, height: H * s }}>
      <div style={{ position: "absolute", left: -minX * s, top: -minY * s, width: frame.w * s, height: frame.h * s, background: "var(--sheet)", boxShadow: "0 0 0 1px rgba(0,0,0,.08)" }} />
      {cards.map((c) => {
        const sc = c.scale ?? 1;
        const style: React.CSSProperties = {
          position: "absolute", left: (c.x - minX) * s, top: (c.y - minY) * s, width: c.w * sc * s, height: height(c) * sc * s, borderRadius: 1,
        };
        // eslint-disable-next-line @next/next/no-img-element
        if (c.kind === "image") return <img key={c.id} src={c.fallbackSrc || c.src} alt="" draggable={false} referrerPolicy="no-referrer" style={{ ...style, objectFit: "cover", background: "#d9d9d6" }} onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />;
        if (c.kind === "text") return <div key={c.id} style={{ ...style, height: Math.max(2, c.size * 0.55 * sc * s), top: (c.y - minY) * s + c.size * 0.35 * sc * s, background: c.color, opacity: 0.55 }} />;
        return <div key={c.id} style={{ ...style, background: "#fff", boxShadow: "0 0 0 1px rgba(0,0,0,.12)" }} />;
      })}
    </div>
  );
}

function timeAgo(t: number) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const hr = Math.round(m / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const d = Math.round(hr / 24);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  const mo = Math.round(d / 30);
  return mo < 12 ? `${mo} month${mo === 1 ? "" : "s"} ago` : `${Math.round(mo / 12)} year${mo < 18 ? "" : "s"} ago`;
}
