"use client";

import { use, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { useBase } from "@/lib/hooks/use-bases";
import { useCreateTable, useDeleteTable, useTables } from "@/lib/hooks/use-tables";
import { ImportWizard } from "@/components/import/import-wizard";

export default function BaseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ baseId: string }>;
}) {
  const { baseId } = use(params);
  const { data: base } = useBase(baseId);
  const { data: tables } = useTables(baseId);
  const createTable = useCreateTable(baseId);
  const deleteTable = useDeleteTable(baseId);
  const pathname = usePathname();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);

  async function onCreateTable() {
    const name = prompt("Table name?");
    if (!name?.trim()) return;
    setCreating(true);
    try {
      const table = await createTable.mutateAsync(name.trim());
      window.location.href = `/b/${baseId}/t/${table.id}`;
    } finally {
      setCreating(false);
    }
  }

  async function onDeleteTable(t: { id: string; name: string }) {
    if (!confirm(`Delete table "${t.name}"? This permanently removes every field and row in it.`)) return;
    const wasActive = pathname.includes(t.id);
    await deleteTable.mutateAsync(t.id);
    if (wasActive) {
      const remaining = tables?.filter((x) => x.id !== t.id) ?? [];
      router.replace(remaining[0] ? `/b/${baseId}/t/${remaining[0].id}` : `/b/${baseId}`);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-1 border-b border-[var(--color-border)] px-3 py-2">
        <Link href={`/w/${base?.workspace_id ?? ""}`} className="mr-2 text-sm text-[var(--color-muted)]">
          ← Bases
        </Link>
        <span className="mr-4 text-sm font-medium">{base?.name}</span>
        <div className="flex flex-1 gap-1 overflow-x-auto">
          {tables?.map((t) => (
            <div
              key={t.id}
              className={clsx(
                "group/tab flex shrink-0 items-center gap-1 rounded px-3 py-1.5 text-sm",
                pathname.includes(t.id)
                  ? "bg-black/5 font-medium dark:bg-white/10"
                  : "text-[var(--color-muted)] hover:bg-black/5 dark:hover:bg-white/5",
              )}
            >
              <Link href={`/b/${baseId}/t/${t.id}`}>{t.name}</Link>
              <button
                onClick={() => onDeleteTable(t)}
                title="Delete table"
                className="hidden text-red-500 hover:text-red-400 group-hover/tab:block"
              >
                ×
              </button>
            </div>
          ))}
          <button
            onClick={onCreateTable}
            disabled={creating}
            className="shrink-0 rounded px-3 py-1.5 text-sm text-[var(--color-muted)] hover:bg-black/5 dark:hover:bg-white/5"
          >
            + Table
          </button>
          <button
            onClick={() => setImporting(true)}
            className="shrink-0 rounded px-3 py-1.5 text-sm text-[var(--color-muted)] hover:bg-black/5 dark:hover:bg-white/5"
          >
            Import CSV
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
      {importing && tables && (
        <ImportWizard
          baseId={baseId}
          tables={tables}
          onClose={() => setImporting(false)}
          onImported={(tableId) => {
            if (tableId) router.push(`/b/${baseId}/t/${tableId}`);
          }}
        />
      )}
    </div>
  );
}
