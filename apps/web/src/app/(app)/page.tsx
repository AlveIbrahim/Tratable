"use client";

import { useState } from "react";
import { useCreateWorkspace, useWorkspaces } from "@/lib/hooks/use-workspaces";
import Link from "next/link";
import { FolderIcon, PlusIcon } from "@/components/ui/icons";

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
    <div className="mx-auto max-w-2xl px-8 py-10">
      <h1 className="mb-1 text-[22px] font-semibold tracking-tight">Your workspaces</h1>
      <p className="mb-7 text-[13.5px] text-[var(--color-fg-muted)]">
        A workspace holds your bases and the people you share them with.
      </p>

      {isLoading && <p className="text-sm text-[var(--color-fg-muted)]">Loading…</p>}

      {!isLoading && workspaces?.length === 0 && (
        <div className="mb-6 flex flex-col items-center gap-2 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-strong)] py-10 text-center">
          <FolderIcon width={22} height={22} className="text-[var(--color-fg-subtle)]" />
          <p className="text-[13.5px] text-[var(--color-fg-muted)]">
            You don&apos;t have a workspace yet — create one to get started.
          </p>
        </div>
      )}

      <ul className="mb-8 space-y-2">
        {workspaces?.map((ws) => (
          <li key={ws.id}>
            <Link
              href={`/w/${ws.id}`}
              className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm shadow-[var(--shadow-sm)] transition-colors hover:border-[var(--color-accent)]"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                <FolderIcon width={16} height={16} />
              </div>
              <span className="font-medium">{ws.name}</span>
              <span className="ml-auto rounded-full bg-[var(--color-surface-hover)] px-2 py-0.5 text-[11px] capitalize text-[var(--color-fg-muted)]">
                {ws.role}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <form onSubmit={onCreate} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New workspace name"
          className="flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
        />
        <button
          type="submit"
          disabled={createWorkspace.isPending}
          className="flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-fg)] shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
        >
          <PlusIcon width={14} height={14} />
          Create
        </button>
      </form>
    </div>
  );
}
