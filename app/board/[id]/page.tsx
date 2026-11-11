"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import Editor from "@/components/Editor";
import { useBoards, useHydrated } from "@/lib/store";
import { useAccount } from "@/lib/sync";

export default function BoardPage() {
  const { id } = useParams<{ id: string }>();
  const hydrated = useHydrated();
  const ready = useAccount((a) => a.ready);
  const board = useBoards((s) => s.boards[id]);

  if (!hydrated || !ready) return null;
  if (!board) {
    return (
      <main className="login">
        <div className="login-card">
          <div className="wordmark">Tack</div>
          <p style={{ margin: 0, fontWeight: 700 }}>Board not found</p>
          <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>It may have been deleted, or it belongs to a different account.</p>
          <Link className="btn" href="/">Back to boards</Link>
        </div>
      </main>
    );
  }
  return <Editor board={board} />;
}
