"use client";

import { use, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { useBase } from "@/lib/hooks/use-bases";
import { useCreateTable, useDeleteTable, useTables } from "@/lib/hooks/use-tables";
import { ImportWizard } from "@/components/import/import-wizard";
import { downloadFile } from "@/lib/api-client";
import { chipColorClass } from "@/lib/colors";
import { DatabaseIcon, DownloadIcon, PlusIcon, TableIcon, UploadIcon, XIcon } from "@/components/ui/icons";

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

  const n = base ? chipColorClass(base.id).replace("chip-", "") : "9";

  return (
    <div className="flex h-full flex-col bg-[var(--color-bg)]">
      <header className="flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5">
        <Link
          href={`/w/${base?.workspace_id ?? ""}`}
          className="text-[13px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
        >
          ← Bases
        </Link>
        <div className="h-4 w-px bg-[var(--color-border)]" />
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] text-xs"
          style={{ background: `var(--chip-${n}-bg)`, color: `var(--chip-${n}-fg)` }}
        >
          {base?.icon ?? <DatabaseIcon width={13} height={13} />}
        </div>
        <span className="text-[13.5px] font-semibold">{base?.name}</span>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => setImporting(true)}
            className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2.5 py-1.5 text-[12.5px] text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]"
          >
            <UploadIcon width={13} height={13} />
            Import CSV
          </button>
          <button
            onClick={() => downloadFile(`/bases/${baseId}/export`, `${base?.name ?? "base"}.zip`)}
            className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2.5 py-1.5 text-[12.5px] text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]"
          >
            <DownloadIcon width={13} height={13} />
            Export base
          </button>
        </div>
      </header>

      <div className="flex items-center gap-0.5 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3">
        {tables?.map((t) => {
          const active = pathname.includes(t.id);
          return (
            <div
              key={t.id}
              className={clsx(
                "group/tab relative flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-[13px] transition-colors",
                active ? "text-[var(--color-fg)]" : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]",
              )}
            >
              <TableIcon width={13} height={13} className="shrink-0 opacity-70" />
              <Link href={`/b/${baseId}/t/${t.id}`} className="font-medium">
                {t.name}
              </Link>
              <button
                onClick={() => onDeleteTable(t)}
                title="Delete table"
                className="hidden rounded p-0.5 text-[var(--color-fg-subtle)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)] group-hover/tab:block"
              >
                <XIcon width={11} height={11} />
              </button>
              {active && <div className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-[var(--color-accent)]" />}
            </div>
          );
        })}
        <button
          onClick={onCreateTable}
          disabled={creating}
          className="flex shrink-0 items-center gap-1 px-3 py-2.5 text-[13px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
        >
          <PlusIcon width={13} height={13} />
          Table
        </button>
      </div>

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
