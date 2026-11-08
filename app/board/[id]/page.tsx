"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import Editor from "@/components/Editor";
import { useBoards, useHydrated } from "@/lib/store";

export default function BoardPage() {
  const { id } = useParams<{ id: string }>();
  const hydrated = useHydrated();
  const board = useBoards((s) => s.boards[id]);

  if (!hydrated) return null;
  if (!board) {
    return (
      <main className="home">
        <h1 className="home-title">Board not found</h1>
        <p className="muted">It may have been deleted, or it was made in a different browser (boards are saved locally for now).</p>
        <Link className="btn" href="/">Back to boards</Link>
      </main>
    );
  }
  return <Editor board={board} />;
}
