"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import type { PageConfig } from "@tratable/shared";
import { useInterface, usePublishInterface, useRegenerateToken, useRenameInterface, useUnpublishInterface } from "@/lib/hooks/use-interfaces";
import { useCreatePage, useDeletePage, usePages, useUpdatePage, type PageSummary } from "@/lib/hooks/use-pages";
import { useTables } from "@/lib/hooks/use-tables";
import { useFields } from "@/lib/hooks/use-fields";
import { useRecords } from "@/lib/hooks/use-records";
import { PageConfigForm, defaultConfigFor } from "@/components/interfaces/page-config-form";
import { GridPageRenderer } from "@/components/interfaces/renderers/grid-page";
import { ListPageRenderer } from "@/components/interfaces/renderers/list-page";
import { RecordDetailPageRenderer } from "@/components/interfaces/renderers/record-detail-page";
import { FormPageRenderer } from "@/components/interfaces/renderers/form-page";
import { DashboardPageRenderer } from "@/components/interfaces/renderers/dashboard-page";
import { PlusIcon, TrashIcon } from "@/components/ui/icons";

const PAGE_TYPES: { value: PageConfig["type"]; label: string }[] = [
  { value: "grid", label: "Grid" },
  { value: "list", label: "List" },
  { value: "record_detail", label: "Record detail" },
  { value: "dashboard", label: "Dashboard" },
  { value: "form", label: "Form" },
];

export default function InterfaceBuilderPage({ params }: { params: Promise<{ baseId: string; interfaceId: string }> }) {
  const { baseId, interfaceId } = use(params);
  const { data: iface } = useInterface(interfaceId);
  const { data: tables } = useTables(baseId);
  const { data: pages } = usePages(interfaceId);
  const createPage = useCreatePage(interfaceId);
  const deletePage = useDeletePage(interfaceId);
  const renameInterface = useRenameInterface(baseId);
  const publish = usePublishInterface();
  const unpublish = useUnpublishInterface();
  const regenerateToken = useRegenerateToken();

  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [addingType, setAddingType] = useState<PageConfig["type"] | null>(null);

  useEffect(() => {
    if (!activePageId && pages && pages.length > 0) setActivePageId(pages[0].id);
  }, [pages, activePageId]);

  const activePage = pages?.find((p) => p.id === activePageId);

  async function onAddPage(type: PageConfig["type"]) {
    const name = prompt("Page name?", PAGE_TYPES.find((t) => t.value === type)?.label);
    if (!name?.trim()) {
      setAddingType(null);
      return;
    }
    const firstTable = tables?.[0]?.id ?? "";
    const page = await createPage.mutateAsync({ name: name.trim(), config: defaultConfigFor(type, firstTable) });
    setActivePageId(page.id);
    setAddingType(null);
  }

  async function onDeletePage(page: PageSummary) {
    if (!confirm(`Delete page "${page.name}"?`)) return;
    await deletePage.mutateAsync(page.id);
    if (activePageId === page.id) setActivePageId(null);
  }

  async function onRename() {
    if (!iface) return;
    const name = prompt("Interface name?", iface.name);
    if (!name?.trim() || name === iface.name) return;
    await renameInterface.mutateAsync({ id: iface.id, name: name.trim() });
  }

  if (!iface) return null;

  const publicUrl = iface.share_token ? `${window.location.origin}/s/${iface.share_token}` : null;

  return (
    <div className="flex h-full">
      {/* Page list sidebar */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="border-b border-[var(--color-border)] px-3 py-2.5">
          <Link href={`/b/${baseId}/i`} className="text-[12px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">
            ← Interfaces
          </Link>
          <button onClick={onRename} className="mt-1 block truncate text-left text-[13.5px] font-semibold hover:underline">
            {iface.name}
          </button>
        </div>
        <div className="flex-1 space-y-0.5 overflow-auto p-2">
          {pages?.map((page) => (
            <div
              key={page.id}
              className={`group flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2 py-1.5 text-[13px] ${
                page.id === activePageId
                  ? "bg-[var(--color-accent-soft)] font-medium text-[var(--color-accent)]"
                  : "text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-fg)]"
              }`}
            >
              <button onClick={() => setActivePageId(page.id)} className="flex-1 truncate text-left">
                {page.name}
              </button>
              <button
                onClick={() => onDeletePage(page)}
                className="hidden rounded p-0.5 text-[var(--color-fg-subtle)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)] group-hover:block"
              >
                <TrashIcon width={12} height={12} />
              </button>
            </div>
          ))}
        </div>
        <div className="relative border-t border-[var(--color-border)] p-2">
          <button
            onClick={() => setAddingType(addingType ? null : "grid")}
            className="flex w-full items-center gap-1.5 rounded-[var(--radius-sm)] px-2 py-1.5 text-[13px] text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-fg)]"
          >
            <PlusIcon width={13} height={13} />
            Add page
          </button>
          {addingType && (
            <div className="absolute bottom-full left-2 z-10 mb-1 w-44 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-raised)] p-1 shadow-[var(--shadow-lg)]">
              {PAGE_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => onAddPage(t.value)}
                  className="block w-full rounded px-2.5 py-1.5 text-left text-[13px] hover:bg-[var(--color-surface-hover)]"
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Publish bar + editor/preview */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2">
          {iface.is_published ? (
            <>
              <span className="rounded-full bg-[var(--color-accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-accent)]">
                Published
              </span>
              {publicUrl && (
                <button
                  onClick={() => navigator.clipboard.writeText(publicUrl)}
                  className="truncate text-[12.5px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                  title="Copy link"
                >
                  {publicUrl}
                </button>
              )}
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => regenerateToken.mutate(iface.id)}
                  className="text-[12.5px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                >
                  Regenerate link
                </button>
                <button
                  onClick={() => unpublish.mutate(iface.id)}
                  className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2.5 py-1 text-[12.5px] hover:border-[var(--color-border-strong)]"
                >
                  Unpublish
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={() => publish.mutate(iface.id)}
              className="ml-auto rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-3 py-1.5 text-[12.5px] font-medium text-white hover:opacity-90"
            >
              Publish
            </button>
          )}
        </div>

        {activePage ? (
          <PageEditor key={activePage.id} interfaceId={interfaceId} baseId={baseId} page={activePage} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-[13.5px] text-[var(--color-fg-subtle)]">
            Add a page to get started.
          </div>
        )}
      </div>
    </div>
  );
}

function PageEditor({ interfaceId, baseId, page }: { interfaceId: string; baseId: string; page: PageSummary }) {
  const { data: tables } = useTables(baseId);
  const updatePage = useUpdatePage(interfaceId);
  const [config, setConfig] = useState<PageConfig>(page.config);
  const [dirty, setDirty] = useState(false);

  function onChange(next: PageConfig) {
    setConfig(next);
    setDirty(true);
  }

  async function onSave() {
    await updatePage.mutateAsync({ id: page.id, config });
    setDirty(false);
  }

  return (
    <div className="flex min-h-0 flex-1">
      <div className="w-80 shrink-0 overflow-auto border-r border-[var(--color-border)] p-4">
        <PageConfigForm config={config} tables={tables ?? []} onChange={onChange} />
        <button
          onClick={onSave}
          disabled={!dirty || updatePage.isPending}
          className="mt-4 w-full rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-3 py-2 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-40"
        >
          {dirty ? "Save changes" : "Saved"}
        </button>
      </div>
      <div className="min-w-0 flex-1 overflow-auto bg-[var(--color-bg)]">
        <PagePreview config={config} />
      </div>
    </div>
  );
}

/** Authenticated preview — reuses the exact same renderer components the
 * public route mounts, fed from the normal (logged-in) API instead of the
 * public one, since a page can be edited long before it's ever published. */
function PagePreview({ config }: { config: PageConfig }) {
  const tableId = "tableId" in config ? config.tableId : config.widgets[0]?.tableId;
  const { data: fields } = useFields(tableId);
  const recordsQuery = useRecords(tableId);
  const records = recordsQuery.data?.pages[0]?.records ?? [];

  if (!tableId) {
    return <div className="p-6 text-[13px] text-[var(--color-fg-subtle)]">Choose a table to preview this page.</div>;
  }

  switch (config.type) {
    case "grid": {
      const visible = (fields ?? []).filter((f) => config.visibleFieldIds.includes(f.id));
      return <GridPageRenderer config={config} fields={visible} records={records} />;
    }
    case "list":
      return <ListPageRenderer config={config} fields={fields ?? []} records={records} />;
    case "record_detail":
      return <RecordDetailPageRenderer config={config} fields={fields ?? []} record={records[0]} />;
    case "form":
      return (
        <FormPageRenderer
          config={config}
          fields={fields ?? []}
          onSubmit={async () => {
            alert("This is a preview — form submissions only work on the published link.");
          }}
        />
      );
    case "dashboard":
      // Dashboard aggregation runs server-side against the public route only
      // (see PublicService.getDashboard) — there's no authenticated
      // equivalent endpoint yet, so the builder can't preview real numbers
      // before publishing.
      return (
        <div className="p-6 text-[13px] text-[var(--color-fg-subtle)]">
          Dashboard widgets are computed after publishing — save your changes, publish, then open the public link to
          see real numbers.
        </div>
      );
  }
}
