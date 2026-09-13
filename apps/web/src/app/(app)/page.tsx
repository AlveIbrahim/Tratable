"use client";

import { useState } from "react";
import { useCreateWorkspace, useWorkspaces } from "@/lib/hooks/use-workspaces";
import Link from "next/link";

export default function HomePage() {
  const { data: workspaces, isLoading } = useWorkspaces();
  const createWorkspace = useCreateWorkspace();
  const [name, setName] = useState("");

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await createWorkspace.mutateAsync(name.trim());
    setName("");
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">Your workspaces</h1>

      {isLoading && <p className="text-sm text-[var(--color-muted)]">Loading…</p>}

      {!isLoading && workspaces?.length === 0 && (
        <p className="mb-4 text-sm text-[var(--color-muted)]">
          You don&apos;t have a workspace yet — create one to get started.
        </p>
      )}

      <ul className="mb-6 space-y-2">
        {workspaces?.map((ws) => (
          <li key={ws.id}>
            <Link
              href={`/w/${ws.id}`}
              className="block rounded border border-[var(--color-border)] px-4 py-3 text-sm hover:border-[var(--color-accent)]"
            >
              {ws.name} <span className="text-[var(--color-muted)]">· {ws.role}</span>
            </Link>
          </li>
        ))}
      </ul>

      <form onSubmit={onCreate} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New workspace name"
          className="flex-1 rounded border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
        />
        <button
          type="submit"
          disabled={createWorkspace.isPending}
          className="rounded bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-fg)] disabled:opacity-50"
        >
          Create
        </button>
      </form>
    </div>
  );
}
