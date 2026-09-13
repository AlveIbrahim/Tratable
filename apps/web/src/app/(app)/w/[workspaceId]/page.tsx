"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useBases, useCreateBase } from "@/lib/hooks/use-bases";
import { DatabaseIcon, PlusIcon } from "@/components/ui/icons";
import { chipColorClass } from "@/lib/colors";

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
    <div className="mx-auto max-w-3xl px-8 py-10">
      <h1 className="mb-1 text-[22px] font-semibold tracking-tight">Bases</h1>
      <p className="mb-7 text-[13.5px] text-[var(--color-fg-muted)]">
        Each base is its own set of tables — pick one or start a new one.
      </p>

      {isLoading && <p className="text-sm text-[var(--color-fg-muted)]">Loading…</p>}

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {bases?.map((base) => {
          const n = chipColorClass(base.id).replace("chip-", "");
          return (
            <Link
              key={base.id}
              href={`/b/${base.id}`}
              className="group rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)] transition-all hover:-translate-y-0.5 hover:border-[var(--color-accent)] hover:shadow-[var(--shadow-md)]"
            >
              <div
                className="mb-3 flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)]"
                style={{ background: `var(--chip-${n}-bg)`, color: `var(--chip-${n}-fg)` }}
              >
                {base.icon ? <span className="text-base leading-none">{base.icon}</span> : <DatabaseIcon width={17} height={17} />}
              </div>
              <div className="truncate text-[13.5px] font-medium">{base.name}</div>
            </Link>
          );
        })}
      </div>

      <form onSubmit={onCreate} className="flex max-w-sm gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New base name"
          className="flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
        />
        <button
          type="submit"
          disabled={createBase.isPending}
          className="flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-fg)] shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
        >
          <PlusIcon width={14} height={14} />
          Create
        </button>
      </form>
    </div>
  );
}
