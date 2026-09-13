"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useBases, useCreateBase } from "@/lib/hooks/use-bases";

export default function WorkspacePage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params);
  const { data: bases, isLoading } = useBases(workspaceId);
  const createBase = useCreateBase(workspaceId);
  const [name, setName] = useState("");

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const base = await createBase.mutateAsync(name.trim());
    setName("");
    window.location.href = `/b/${base.id}`;
  }

  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">Bases</h1>

      {isLoading && <p className="text-sm text-[var(--color-muted)]">Loading…</p>}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {bases?.map((base) => (
          <Link
            key={base.id}
            href={`/b/${base.id}`}
            className="rounded border border-[var(--color-border)] p-4 text-sm hover:border-[var(--color-accent)]"
          >
            <div className="mb-1 text-lg">{base.icon ?? "🗂️"}</div>
            {base.name}
          </Link>
        ))}
      </div>

      <form onSubmit={onCreate} className="flex max-w-sm gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New base name"
          className="flex-1 rounded border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
        />
        <button
          type="submit"
          disabled={createBase.isPending}
          className="rounded bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-fg)] disabled:opacity-50"
        >
          Create
        </button>
      </form>
    </div>
  );
}
