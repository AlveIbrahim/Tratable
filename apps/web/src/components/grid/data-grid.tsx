"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { RecordDto, SortSpec } from "@tratable/shared";
import type { FieldSummary } from "@/lib/hooks/use-fields";
import { useDeleteField } from "@/lib/hooks/use-fields";
import { downloadFile } from "@/lib/api-client";
import { useTable } from "@/lib/hooks/use-tables";
import { useActiveView } from "@/lib/hooks/use-views";
import { useCreateRecord, useDeleteRecord, useRecords, useUpdateRecord } from "@/lib/hooks/use-records";
import { useGridStore } from "@/lib/grid-store";
import { chipColorClass } from "@/lib/colors";
import { CellDisplay, CellEditor } from "./cell";
import { AddFieldButton } from "./add-field-button";
import { ViewToolbar } from "./view-toolbar";
import { DownloadIcon, FieldTypeIcon, PlusIcon, TrashIcon, XIcon } from "@/components/ui/icons";

const ROW_HEIGHT = 34;
const GROUP_HEADER_HEIGHT = 32;
const DEFAULT_COL_WIDTH = 180;
const MIN_COL_WIDTH = 80;
const ROW_HEADER_WIDTH = 46;

interface Choice {
  id: string;
  name: string;
}

/** Per-field column widths, resizable by dragging the header's right edge
 * (like Airtable/Excel). Persisted to localStorage per table so a reload
 * doesn't reset the layout — full server-side persistence into the view's
 * config is a reasonable follow-up once views support partial-field patches
 * from the grid rather than just the builder. */
function useColumnWidths(tableId: string) {
  const storageKey = `tratable:col-widths:${tableId}`;
  const [widths, setWidths] = useState<Record<string, number>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      setWidths(raw ? JSON.parse(raw) : {});
    } catch {
      setWidths({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const setWidth = useCallback(
    (fieldId: string, width: number) => {
      setWidths((prev) => {
        const next = { ...prev, [fieldId]: width };
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // best-effort only — a private window or full storage shouldn't break resizing
        }
        return next;
      });
    },
    [storageKey],
  );

  const getWidth = useCallback((fieldId: string) => widths[fieldId] ?? DEFAULT_COL_WIDTH, [widths]);
  return { getWidth, setWidth };
}

/** Drag handle on a column header's right edge. Pointer events (not mouse
 * events) so it works the same with touch/pen, and setPointerCapture keeps
 * receiving move events even if the cursor leaves the handle mid-drag. */
function ColumnResizeHandle({ width, onResize }: { width: number; onResize: (width: number) => void }) {
  const startRef = useRef<{ x: number; width: number } | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    startRef.current = { x: e.clientX, width };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!startRef.current) return;
    const delta = e.clientX - startRef.current.x;
    onResize(Math.max(MIN_COL_WIDTH, startRef.current.width + delta));
  }

  function onPointerUp(e: React.PointerEvent) {
    startRef.current = null;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="absolute -right-1 top-0 z-10 h-full w-2 cursor-col-resize touch-none select-none hover:bg-[var(--color-accent)]/40"
    />
  );
}

/** Renders a group-by value the same way the field's own chips render it
 * elsewhere (choice name via chip, not a raw id), so "Group by Status"
 * reads the header as "Pro" / "Basic", never an opaque opt_xxxxx string. */
function groupLabel(field: FieldSummary, value: unknown): string {
  if (value === null || value === undefined || value === "") return "Empty";
  if (field.type === "checkbox") return value ? "Checked" : "Unchecked";
  if (field.type === "singleSelect") {
    const choices = (field.options.choices as Choice[]) ?? [];
    return choices.find((c) => c.id === value)?.name ?? String(value);
  }
  if (field.type === "multiSelect" && Array.isArray(value)) {
    const choices = (field.options.choices as Choice[]) ?? [];
    return value.map((id) => choices.find((c) => c.id === id)?.name ?? id).join(", ") || "Empty";
  }
  return String(value);
}

/** Grouping is implemented purely client-side over the already-sorted flat
 * record list — never a server-side concept. It only produces correct,
 * contiguous buckets because the caller guarantees the group field is
 * always sort column zero (see effectiveSorts below); this function just
 * walks the list once looking for where that column's value changes. */
type FlatItem =
  | { type: "group"; key: string; label: string; count: number; colorKey: string }
  | { type: "record"; record: RecordDto };

function buildFlatItems(records: RecordDto[], groupField: FieldSummary | undefined): FlatItem[] {
  if (!groupField) return records.map((record) => ({ type: "record", record }));

  const items: FlatItem[] = [];
  let currentKey: string | null = null;
  let groupStartIdx = -1;

  const finalizeGroup = () => {
    if (groupStartIdx === -1) return;
    let count = 0;
    for (let i = groupStartIdx; i < items.length; i++) if (items[i].type === "record") count++;
    (items[groupStartIdx] as Extract<FlatItem, { type: "group" }>).count = count;
  };

  for (const record of records) {
    const value = record.data[groupField.id];
    const key = JSON.stringify(value ?? null);
    if (key !== currentKey) {
      finalizeGroup();
      currentKey = key;
      groupStartIdx = items.length;
      // Color the group header chip by the SAME identity a cell's own chip
      // uses (the raw choice id, for select types) — not the JSON-stringified
      // bucket key, which would hash to a different, mismatched color.
      let colorKey = key;
      if (groupField.type === "singleSelect" && typeof value === "string") {
        colorKey = value;
      } else if (groupField.type === "multiSelect" && Array.isArray(value) && typeof value[0] === "string") {
        colorKey = value[0];
      }
      items.push({ type: "group", key, label: groupLabel(groupField, value), count: 0, colorKey });
    }
    items.push({ type: "record", record });
  }
  finalizeGroup();
  return items;
}

export function DataGrid({ tableId, fields }: { tableId: string; fields: FieldSummary[] }) {
  const { data: view } = useActiveView(tableId);
  const config = view?.config;

  // Grouping is a sort under the hood — the group field must be sort column
  // zero for same-group rows to land contiguously, so it's prepended unless
  // already there. This is the only place "group" logic touches the query;
  // the API has no idea grouping exists, it only ever sees an ordinary
  // multi-column sort (see records.service.ts's list()).
  const effectiveSorts: SortSpec[] | undefined = useMemo(() => {
    if (!config) return undefined;
    const sorts = config.sorts ?? [];
    if (!config.groupByFieldId) return sorts;
    if (sorts[0]?.fieldId === config.groupByFieldId) return sorts;
    return [{ fieldId: config.groupByFieldId, direction: "asc" as const }, ...sorts];
  }, [config]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useRecords(
    tableId,
    config?.filters,
    effectiveSorts,
  );
  const records: RecordDto[] = useMemo(() => data?.pages.flatMap((p) => p.records) ?? [], [data]);

  const createRecord = useCreateRecord(tableId);
  const updateRecord = useUpdateRecord(tableId);
  const deleteRecord = useDeleteRecord(tableId);
  const deleteField = useDeleteField(tableId);
  const { data: table } = useTable(tableId);
  const { getWidth, setWidth } = useColumnWidths(tableId);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const { activeRowId, activeFieldId, mode, setActive, startEditing, stopEditing } = useGridStore();

  const groupField = config?.groupByFieldId ? fields.find((f) => f.id === config.groupByFieldId) : undefined;
  const colorField = config?.colorFieldId ? fields.find((f) => f.id === config.colorFieldId) : undefined;

  const flatItems = useMemo(() => buildFlatItems(records, groupField), [records, groupField]);
  const flatIndexByRecordId = useMemo(() => {
    const map = new Map<string, number>();
    flatItems.forEach((item, idx) => {
      if (item.type === "record") map.set(item.record.id, idx);
    });
    return map;
  }, [flatItems]);

  /** Row background tint for "Color by field" — reuses the exact same
   * id-hashed chip palette as every chip elsewhere, so a colored row always
   * matches the color of its own chip. Multi-select colors by its first
   * choice; there's no single color for an arbitrary combination. */
  function rowTint(record: RecordDto): string | undefined {
    if (!colorField) return undefined;
    const value = record.data[colorField.id];
    const choiceId =
      colorField.type === "singleSelect" ? (value as string | undefined)
      : colorField.type === "multiSelect" && Array.isArray(value) ? (value[0] as string | undefined)
      : undefined;
    if (!choiceId) return undefined;
    const n = chipColorClass(choiceId).replace("chip-", "");
    return `var(--chip-${n}-bg)`;
  }

  const containerRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => containerRef.current,
    estimateSize: (index) => (flatItems[index]?.type === "group" ? GROUP_HEADER_HEIGHT : ROW_HEIGHT),
    overscan: 12,
    onChange: (instance) => {
      const lastItem = instance.getVirtualItems().at(-1);
      if (lastItem && lastItem.index >= flatItems.length - 5 && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
  });

  function moveActive(rowDelta: number, colDelta: number) {
    const rowIdx = records.findIndex((r) => r.id === activeRowId);
    const colIdx = fields.findIndex((f) => f.id === activeFieldId);
    if (rowIdx === -1 || colIdx === -1) {
      if (records[0] && fields[0]) setActive(records[0].id, fields[0].id);
      return;
    }
    const nextRow = records[Math.min(Math.max(rowIdx + rowDelta, 0), records.length - 1)];
    const nextField = fields[Math.min(Math.max(colIdx + colDelta, 0), fields.length - 1)];
    setActive(nextRow.id, nextField.id);
    const flatIdx = flatIndexByRecordId.get(nextRow.id);
    if (flatIdx !== undefined) rowVirtualizer.scrollToIndex(flatIdx);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (mode === "edit") return; // editor owns keys while editing
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        moveActive(-1, 0);
        break;
      case "ArrowDown":
        e.preventDefault();
        moveActive(1, 0);
        break;
      case "ArrowLeft":
        e.preventDefault();
        moveActive(0, -1);
        break;
      case "ArrowRight":
      case "Tab":
        e.preventDefault();
        moveActive(0, 1);
        break;
      case "Enter":
        e.preventDefault();
        if (activeRowId && activeFieldId) startEditing();
        break;
      case "Backspace":
      case "Delete":
        if (activeRowId && activeFieldId) {
          e.preventDefault();
          updateRecord.mutate({ recordId: activeRowId, data: { [activeFieldId]: null } });
        }
        break;
    }
  }

  function commitCell(recordId: string, fieldId: string, value: unknown, advanceDown = true) {
    updateRecord.mutate({ recordId, data: { [fieldId]: value } });
    stopEditing();
    if (advanceDown) moveActive(1, 0);
  }

  async function onAddRow() {
    const rec = await createRecord.mutateAsync({});
    setActive(rec.id, fields[0]?.id ?? null);
  }

  async function onDeleteField(field: FieldSummary) {
    if (field.id === table?.primary_field_id) {
      setFieldError("The primary field can't be deleted.");
      return;
    }
    if (!confirm(`Delete field "${field.name}"? This removes its data from every row.`)) return;
    try {
      await deleteField.mutateAsync(field.id);
    } catch (e) {
      setFieldError(e instanceof Error ? e.message : "Failed to delete field");
    }
  }

  const gridWidth = ROW_HEADER_WIDTH + fields.reduce((sum, f) => sum + getWidth(f.id), 0) + DEFAULT_COL_WIDTH;

  return (
    <div className="flex h-full flex-col bg-[var(--color-bg)]">
      {view && <ViewToolbar tableId={tableId} view={view} fields={fields} />}
      {fieldError && (
        <div className="flex items-center justify-between border-b border-[var(--color-danger)]/20 bg-[var(--color-danger-soft)] px-3 py-1.5 text-[13px] text-[var(--color-danger)]">
          {fieldError}
          <button onClick={() => setFieldError(null)} className="rounded p-0.5 hover:bg-black/5">
            <XIcon width={13} height={13} />
          </button>
        </div>
      )}
      <div
        className="flex-1 overflow-auto outline-none"
        ref={containerRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        <div style={{ width: gridWidth, minWidth: "100%" }}>
          {/* Header row */}
          <div className="sticky top-0 z-10 flex border-b border-[var(--color-border)] bg-[var(--color-surface)]">
            <div style={{ width: ROW_HEADER_WIDTH }} className="shrink-0 border-r border-[var(--color-border)]" />
            {fields.map((f) => (
              <div
                key={f.id}
                style={{ width: getWidth(f.id) }}
                className="group/header relative flex shrink-0 items-center gap-1.5 border-r border-[var(--color-border)] px-2.5 py-2 text-[12px] font-medium text-[var(--color-fg-muted)]"
                title={f.name}
              >
                <FieldTypeIcon type={f.type} width={13} height={13} className="shrink-0 opacity-70" />
                <span className="truncate">{f.name}</span>
                {f.id !== table?.primary_field_id && (
                  <button
                    onClick={() => onDeleteField(f)}
                    title="Delete field"
                    className="ml-auto hidden shrink-0 rounded p-0.5 text-[var(--color-fg-subtle)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)] group-hover/header:block"
                  >
                    <XIcon width={12} height={12} />
                  </button>
                )}
                <ColumnResizeHandle width={getWidth(f.id)} onResize={(w) => setWidth(f.id, w)} />
              </div>
            ))}
            <div style={{ width: DEFAULT_COL_WIDTH }} className="shrink-0">
              <AddFieldButton tableId={tableId} />
            </div>
          </div>

          {/* Virtualized body */}
          <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const item = flatItems[virtualRow.index];
              if (!item) return null;

              if (item.type === "group") {
                return (
                  <div
                    key={`group-${item.key}-${virtualRow.index}`}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: GROUP_HEADER_HEIGHT,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[12px] font-medium"
                  >
                    <span
                      className="rounded-full px-2 py-0.5 text-[11.5px] font-medium"
                      style={{
                        background: `var(--chip-${chipColorClass(item.colorKey).replace("chip-", "")}-bg)`,
                        color: `var(--chip-${chipColorClass(item.colorKey).replace("chip-", "")}-fg)`,
                      }}
                    >
                      {item.label}
                    </span>
                    <span className="text-[var(--color-fg-subtle)]">{item.count}</span>
                  </div>
                );
              }

              const record = item.record;
              const tint = rowTint(record);
              return (
                <div
                  key={record.id}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: ROW_HEIGHT,
                    transform: `translateY(${virtualRow.start}px)`,
                    backgroundColor: tint,
                  }}
                  className={`group/row flex border-b border-[var(--color-border)] ${
                    tint ? "hover:brightness-95 dark:hover:brightness-125" : "hover:bg-[var(--color-surface-hover)]"
                  }`}
                >
                  <div
                    style={{ width: ROW_HEADER_WIDTH }}
                    className="flex shrink-0 items-center justify-center border-r border-[var(--color-border)] text-[11.5px] text-[var(--color-fg-subtle)]"
                  >
                    <span className="group-hover/row:hidden">{records.indexOf(record) + 1}</span>
                    <button
                      className="hidden rounded p-0.5 text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] group-hover/row:block"
                      onClick={() => deleteRecord.mutate(record.id)}
                      title="Delete row"
                    >
                      <TrashIcon width={12} height={12} />
                    </button>
                  </div>
                  {fields.map((f) => {
                    const isActive = activeRowId === record.id && activeFieldId === f.id;
                    const isEditing = isActive && mode === "edit";
                    return (
                      <div
                        key={f.id}
                        style={{ width: getWidth(f.id) }}
                        onClick={() => {
                          // Clicking inside a cell that's already the one being
                          // edited (toggling a checkbox, picking a select option)
                          // must NOT re-run setActive — setActive unconditionally
                          // resets mode to "nav", which was yanking every
                          // pointer-driven editor (checkbox, select) out of edit
                          // mode before its click could ever reach onCommit.
                          // Keyboard-committed editors (Enter on a text input)
                          // never hit this because a keydown never bubbles into
                          // this onClick, which is exactly why only those looked
                          // like they worked.
                          if (isEditing) return;
                          setActive(record.id, f.id);
                        }}
                        onDoubleClick={() => {
                          setActive(record.id, f.id);
                          startEditing();
                        }}
                        className={`relative flex shrink-0 items-center truncate border-r border-[var(--color-border)] px-2.5 text-[13px] ${
                          isActive
                            ? "z-[1] bg-[var(--color-surface)] ring-2 ring-inset ring-[var(--color-accent)]"
                            : ""
                        }`}
                      >
                        {isEditing ? (
                          <CellEditor
                            field={f}
                            tableId={tableId}
                            value={record.data[f.id]}
                            onCommit={(v) => commitCell(record.id, f.id, v)}
                            onCancel={stopEditing}
                          />
                        ) : (
                          <CellDisplay field={f} value={record.data[f.id]} />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-[var(--color-border)] bg-[var(--color-surface)]">
        <button
          onClick={onAddRow}
          disabled={createRecord.isPending}
          className="flex flex-1 items-center gap-1.5 px-3 py-2 text-left text-[12.5px] text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-fg)]"
        >
          <PlusIcon width={13} height={13} />
          Add row
        </button>
        <button
          onClick={() => downloadFile(`/tables/${tableId}/export`, `${tableId}.csv`)}
          className="flex shrink-0 items-center gap-1.5 px-3 py-2 text-[12.5px] text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-fg)]"
        >
          <DownloadIcon width={13} height={13} />
          Export CSV
        </button>
      </div>
    </div>
  );
}
