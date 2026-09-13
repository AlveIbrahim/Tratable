"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCreateInterface, useDeleteInterface, useInterfaces } from "@/lib/hooks/use-interfaces";
import { FolderIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";

export default function InterfacesListPage({ params }: { params: Promise<{ baseId: string }> }) {
  const { baseId } = use(params);
  const { data: interfaces } = useInterfaces(baseId);
  const createInterface = useCreateInterface(baseId);
  const deleteInterface = useDeleteInterface(baseId);
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  async function onCreate() {
    const name = prompt("Interface name?");
    if (!name?.trim()) return;
    setCreating(true);
    try {
      const iface = await createInterface.mutateAsync(name.trim());
      router.push(`/b/${baseId}/i/${iface.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function onDelete(id: string, name: string) {
    if (!confirm(`Delete interface "${name}" and all its pages?`)) return;
    await deleteInterface.mutateAsync(id);
  }

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[18px] font-semibold">Interfaces</h1>
        <button
          onClick={onCreate}
          disabled={creating}
          className="flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-3 py-1.5 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          <PlusIcon width={13} height={13} />
          New interface
        </button>
      </div>

      {interfaces?.length === 0 && (
        <p className="text-[13.5px] text-[var(--color-fg-subtle)]">
          Compose grid, list, record, dashboard, and form pages bound to your tables, then publish them as a shareable
          link — no login required for viewers.
        </p>
      )}

      <div className="space-y-2">
        {interfaces?.map((iface) => (
          <div
            key={iface.id}
            className="group flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3 hover:border-[var(--color-border-strong)]"
          >
            <FolderIcon width={16} height={16} className="shrink-0 text-[var(--color-fg-subtle)]" />
            <Link href={`/b/${baseId}/i/${iface.id}`} className="flex-1 text-[13.5px] font-medium hover:underline">
              {iface.name}
            </Link>
            {iface.is_published && (
              <span className="rounded-full bg-[var(--color-accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-accent)]">
                Published
              </span>
            )}
            <button
              onClick={() => onDelete(iface.id, iface.name)}
              className="hidden shrink-0 rounded p-1 text-[var(--color-fg-subtle)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)] group-hover:block"
            >
              <TrashIcon width={14} height={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
