"use client";

import { useEffect, useRef, useState } from "react";
import type { FilterCondition, FilterOp, SortSpec } from "@tratable/shared";
import { isFilterGroup } from "@tratable/shared";
import type { FieldSummary } from "@/lib/hooks/use-fields";
import type { ViewConfigPatch, ViewSummary } from "@/lib/hooks/use-views";
import { useUpdateView } from "@/lib/hooks/use-views";
import { Select } from "@/components/ui/select";
import { FilterValueInput } from "./filter-value-input";
import {
  COLORABLE_TYPES,
  GROUPABLE_TYPES,
  NO_VALUE_OPS,
  OPS_BY_FIELD_TYPE,
  OP_LABELS,
  SORT_DIRECTION_LABELS,
} from "@/lib/filter-meta";
import { ChevronDownIcon, PaletteIcon, PlusIcon, SortIcon, TagsIcon, TrashIcon } from "@/components/ui/icons";

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);
  return { open, setOpen, ref };
}

function ToolbarButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12.5px] font-medium transition-colors ${
        active
          ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
          : "text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-fg)]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

export function ViewToolbar({
  tableId,
  view,
  fields,
}: {
  tableId: string;
  view: ViewSummary;
  fields: FieldSummary[];
}) {
  const updateView = useUpdateView(tableId);
  const config = view.config;

  function patch(next: ViewConfigPatch) {
    updateView.mutate({ viewId: view.id, config: next });
  }

  const filterGroup =
    config.filters && isFilterGroup(config.filters) ? config.filters : { conjunction: "and" as const, children: [] };
  const conditions = filterGroup.children.filter((c): c is FilterCondition => !isFilterGroup(c));

  function setConditions(next: FilterCondition[], conjunction: "and" | "or" = filterGroup.conjunction) {
    // `null`, not `undefined` — see ViewConfigPatch: only null survives JSON
    // encoding as an explicit "clear this key" instruction to the server.
    patch({ filters: next.length > 0 ? { conjunction, children: next } : null });
  }

  const sorts = config.sorts ?? [];
  function setSorts(next: SortSpec[]) {
    patch({ sorts: next });
  }

  const filterPop = usePopover();
  const sortPop = usePopover();
  const groupPop = usePopover();
  const colorPop = usePopover();

  const fieldById = (id: string) => fields.find((f) => f.id === id);
  const groupableFields = fields.filter((f) => GROUPABLE_TYPES.includes(f.type));
  const colorableFields = fields.filter((f) => COLORABLE_TYPES.includes(f.type));

  return (
    <div className="flex items-center gap-1 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5">
      {/* Filter */}
      <div className="relative" ref={filterPop.ref}>
        <ToolbarButton
          active={conditions.length > 0}
          label={conditions.length > 0 ? `Filter (${conditions.length})` : "Filter"}
          icon={<TagsIcon width={13} height={13} />}
          onClick={() => filterPop.setOpen((v) => !v)}
        />
        {filterPop.open && (
          <div className="absolute left-0 top-full z-30 mt-1 w-[320px] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-raised)] p-3 shadow-[var(--shadow-lg)]">
            {conditions.length === 0 && (
              <p className="mb-2 text-[12.5px] text-[var(--color-fg-subtle)]">No filters applied to this view.</p>
            )}
            <div className="space-y-2.5">
              {conditions.map((cond, idx) => {
                const field = fieldById(cond.fieldId);
                if (!field) return null;
                const ops = OPS_BY_FIELD_TYPE[field.type];
                return (
                  // Two lines per condition, not one — cramming field select +
                  // operator select + value editor + delete button onto a
                  // single row meant their widths had to sum to *exactly* the
                  // popover's width with zero slack, and any content just a
                  // few px wider than expected (a longer field/operator name,
                  // a wider value control) pushed the delete button out past
                  // the popover's edge instead of fitting inside it. Splitting
                  // the value editor onto its own full-width line removes that
                  // squeeze entirely, regardless of how wide any label gets.
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-10 shrink-0 text-[12px] text-[var(--color-fg-subtle)]">
                        {idx === 0 ? "Where" : filterGroup.conjunction === "and" ? "and" : "or"}
                      </span>
                      <Select
                        className="min-w-0 flex-1"
                        value={field.id}
                        onChange={(v) => {
                          const nf = fieldById(v)!;
                          const nextOps = OPS_BY_FIELD_TYPE[nf.type];
                          const next = [...conditions];
                          next[idx] = { fieldId: v, op: nextOps[0], value: undefined };
                          setConditions(next);
                        }}
                        options={fields.map((f) => ({ value: f.id, label: f.name }))}
                      />
                      <button
                        onClick={() => setConditions(conditions.filter((_, i) => i !== idx))}
                        className="shrink-0 rounded p-1 text-[var(--color-fg-subtle)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
                      >
                        <TrashIcon width={13} height={13} />
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 pl-11">
                      <Select
                        className="min-w-0 flex-1"
                        value={cond.op}
                        onChange={(v) => {
                          const next = [...conditions];
                          next[idx] = { ...cond, op: v as FilterOp, value: undefined };
                          setConditions(next);
                        }}
                        options={ops.map((op) => ({ value: op, label: OP_LABELS[op] }))}
                      />
                      {!NO_VALUE_OPS.has(cond.op) && (
                        <div className="min-w-0 flex-1">
                          <FilterValueInput
                            field={field}
                            op={cond.op}
                            value={cond.value}
                            onChange={(value) => {
                              const next = [...conditions];
                              next[idx] = { ...cond, value };
                              setConditions(next);
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2.5 flex items-center justify-between">
              <button
                onClick={() => {
                  const first = fields[0];
                  if (!first) return;
                  setConditions([...conditions, { fieldId: first.id, op: OPS_BY_FIELD_TYPE[first.type][0] }]);
                }}
                className="flex items-center gap-1 text-[12.5px] font-medium text-[var(--color-accent)] hover:underline"
              >
                <PlusIcon width={12} height={12} />
                Add condition
              </button>
              {conditions.length > 1 && (
                <Select
                  className="w-20"
                  value={filterGroup.conjunction}
                  onChange={(v) => setConditions(conditions, v as "and" | "or")}
                  options={[
                    { value: "and", label: "and" },
                    { value: "or", label: "or" },
                  ]}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sort */}
      <div className="relative" ref={sortPop.ref}>
        <ToolbarButton
          active={sorts.length > 0}
          label={sorts.length > 0 ? `Sort (${sorts.length})` : "Sort"}
          icon={<SortIcon width={13} height={13} />}
          onClick={() => sortPop.setOpen((v) => !v)}
        />
        {sortPop.open && (
          <div className="absolute left-0 top-full z-30 mt-1 w-[340px] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-raised)] p-3 shadow-[var(--shadow-lg)]">
            {sorts.length === 0 && (
              <p className="mb-2 text-[12.5px] text-[var(--color-fg-subtle)]">No sort applied to this view.</p>
            )}
            <div className="space-y-2">
              {sorts.map((s, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <span className="w-8 shrink-0 text-[12px] text-[var(--color-fg-subtle)]">
                    {idx === 0 ? "Sort" : "then"}
                  </span>
                  <Select
                    className="flex-1"
                    value={s.fieldId}
                    onChange={(v) => {
                      const next = [...sorts];
                      next[idx] = { ...s, fieldId: v };
                      setSorts(next);
                    }}
                    options={fields.map((f) => ({ value: f.id, label: f.name }))}
                  />
                  <Select
                    className="w-32 shrink-0"
                    value={s.direction}
                    onChange={(v) => {
                      const next = [...sorts];
                      next[idx] = { ...s, direction: v as "asc" | "desc" };
                      setSorts(next);
                    }}
                    options={(() => {
                      const dirLabels = SORT_DIRECTION_LABELS[fieldById(s.fieldId)?.type ?? "singleLineText"];
                      return [
                        { value: "asc", label: dirLabels.asc },
                        { value: "desc", label: dirLabels.desc },
                      ];
                    })()}
                  />
                  <button
                    onClick={() => setSorts(sorts.filter((_, i) => i !== idx))}
                    className="shrink-0 rounded p-1 text-[var(--color-fg-subtle)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
                  >
                    <TrashIcon width={13} height={13} />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                const used = new Set(sorts.map((s) => s.fieldId));
                const next = fields.find((f) => !used.has(f.id));
                if (!next) return;
                setSorts([...sorts, { fieldId: next.id, direction: "asc" }]);
              }}
              disabled={sorts.length >= fields.length}
              className="mt-2.5 flex items-center gap-1 text-[12.5px] font-medium text-[var(--color-accent)] hover:underline disabled:opacity-40"
            >
              <PlusIcon width={12} height={12} />
              Add sort
            </button>
          </div>
        )}
      </div>

      {/* Group */}
      <div className="relative" ref={groupPop.ref}>
        <ToolbarButton
          active={!!config.groupByFieldId}
          label={config.groupByFieldId ? `Group: ${fieldById(config.groupByFieldId)?.name ?? ""}` : "Group"}
          icon={<ChevronDownIcon width={13} height={13} />}
          onClick={() => groupPop.setOpen((v) => !v)}
        />
        {groupPop.open && (
          <div className="absolute left-0 top-full z-30 mt-1 w-64 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-raised)] p-3 shadow-[var(--shadow-lg)]">
            <p className="mb-2 text-[12px] font-medium text-[var(--color-fg-muted)]">Group by field</p>
            <Select
              value={config.groupByFieldId ?? ""}
              onChange={(v) => patch({ groupByFieldId: v || null })}
              placeholder="None"
              options={[{ value: "", label: "None" }, ...groupableFields.map((f) => ({ value: f.id, label: f.name }))]}
            />
          </div>
        )}
      </div>

      {/* Color */}
      <div className="relative" ref={colorPop.ref}>
        <ToolbarButton
          active={!!config.colorFieldId}
          label={config.colorFieldId ? `Color: ${fieldById(config.colorFieldId)?.name ?? ""}` : "Color"}
          icon={<PaletteIcon width={13} height={13} />}
          onClick={() => colorPop.setOpen((v) => !v)}
        />
        {colorPop.open && (
          <div className="absolute left-0 top-full z-30 mt-1 w-64 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-raised)] p-3 shadow-[var(--shadow-lg)]">
            <p className="mb-2 text-[12px] font-medium text-[var(--color-fg-muted)]">Color rows by field</p>
            {colorableFields.length === 0 ? (
              <p className="text-[12px] text-[var(--color-fg-subtle)]">
                Add a single or multiple select field to color rows by its choices.
              </p>
            ) : (
              <Select
                value={config.colorFieldId ?? ""}
                onChange={(v) => patch({ colorFieldId: v || null })}
                placeholder="None"
                options={[{ value: "", label: "None" }, ...colorableFields.map((f) => ({ value: f.id, label: f.name }))]}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
