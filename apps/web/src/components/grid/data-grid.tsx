"use client";

import { useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { RecordDto } from "@tratable/shared";
import type { FieldSummary } from "@/lib/hooks/use-fields";
import { useCreateRecord, useDeleteRecord, useRecords, useUpdateRecord } from "@/lib/hooks/use-records";
import { useGridStore } from "@/lib/grid-store";
import { CellDisplay, CellEditor } from "./cell";
import { AddFieldButton } from "./add-field-button";

const ROW_HEIGHT = 32;
const COL_WIDTH = 180;
const ROW_HEADER_WIDTH = 44;

export function DataGrid({ tableId, fields }: { tableId: string; fields: FieldSummary[] }) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useRecords(tableId);
  const records: RecordDto[] = useMemo(() => data?.pages.flatMap((p) => p.records) ?? [], [data]);

  const createRecord = useCreateRecord(tableId);
  const updateRecord = useUpdateRecord(tableId);
  const deleteRecord = useDeleteRecord(tableId);

  const { activeRowId, activeFieldId, mode, setActive, startEditing, stopEditing } = useGridStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: records.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
    onChange: (instance) => {
      const lastItem = instance.getVirtualItems().at(-1);
      if (lastItem && lastItem.index >= records.length - 5 && hasNextPage && !isFetchingNextPage) {
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
    rowVirtualizer.scrollToIndex(Math.min(Math.max(rowIdx + rowDelta, 0), records.length - 1));
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

  const gridWidth = ROW_HEADER_WIDTH + fields.length * COL_WIDTH;

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex-1 overflow-auto outline-none"
        ref={containerRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        <div style={{ width: gridWidth, minWidth: "100%" }}>
          {/* Header row */}
          <div className="sticky top-0 z-10 flex border-b border-[var(--color-border)] bg-[var(--color-bg)]">
            <div style={{ width: ROW_HEADER_WIDTH }} className="shrink-0 border-r border-[var(--color-border)]" />
            {fields.map((f) => (
              <div
                key={f.id}
                style={{ width: COL_WIDTH }}
                className="shrink-0 truncate border-r border-[var(--color-border)] px-2 py-1.5 text-xs font-medium text-[var(--color-muted)]"
                title={f.name}
              >
                {f.name}
              </div>
            ))}
            <div style={{ width: COL_WIDTH }} className="shrink-0">
              <AddFieldButton tableId={tableId} />
            </div>
          </div>

          {/* Virtualized body */}
          <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const record = records[virtualRow.index];
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
                  }}
                  className="flex border-b border-[var(--color-border)]"
                >
                  <div
                    style={{ width: ROW_HEADER_WIDTH }}
                    className="group flex shrink-0 items-center justify-center border-r border-[var(--color-border)] text-xs text-[var(--color-muted)]"
                  >
                    <span className="group-hover:hidden">{virtualRow.index + 1}</span>
                    <button
                      className="hidden text-red-500 group-hover:block"
                      onClick={() => deleteRecord.mutate(record.id)}
                      title="Delete row"
                    >
                      ×
                    </button>
                  </div>
                  {fields.map((f) => {
                    const isActive = activeRowId === record.id && activeFieldId === f.id;
                    const isEditing = isActive && mode === "edit";
                    return (
                      <div
                        key={f.id}
                        style={{ width: COL_WIDTH }}
                        onClick={() => setActive(record.id, f.id)}
                        onDoubleClick={() => {
                          setActive(record.id, f.id);
                          startEditing();
                        }}
                        className={`shrink-0 truncate border-r border-[var(--color-border)] px-2 py-1 text-sm ${
                          isActive ? "ring-1 ring-inset ring-[var(--color-accent)]" : ""
                        }`}
                      >
                        {isEditing ? (
                          <CellEditor
                            field={f}
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
      <button
        onClick={onAddRow}
        disabled={createRecord.isPending}
        className="border-t border-[var(--color-border)] px-3 py-2 text-left text-sm text-[var(--color-muted)] hover:bg-black/5 dark:hover:bg-white/5"
      >
        + Add row
      </button>
    </div>
  );
}
