"use client";

import type { FieldType, FilterOp } from "@tratable/shared";
import type { FieldSummary } from "@/lib/hooks/use-fields";
import { Select } from "@/components/ui/select";
import { chipStyle } from "@/lib/colors";

interface Choice {
  id: string;
  name: string;
}

/** The value editor for one filter condition — dispatched by the field's
 * type, same spirit as the grid's own per-type cell editors. isEmpty/
 * isNotEmpty/isChecked/isUnchecked take no value at all (guarded by the
 * caller via NO_VALUE_OPS, not here). */
export function FilterValueInput({
  field,
  op,
  value,
  onChange,
}: {
  field: FieldSummary;
  op: FilterOp;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const type: FieldType = field.type;

  if (type === "singleSelect") {
    const choices = (field.options.choices as Choice[]) ?? [];
    return (
      // No width class: sizes to the selected choice's own label (see the
      // popover's shrink-to-fit comment in view-toolbar.tsx) instead of
      // wrapping/clipping a long choice name inside a box sized for a
      // short one.
      <Select
        value={(value as string) ?? ""}
        onChange={onChange}
        placeholder="Choose…"
        options={choices.map((c) => ({ value: c.id, label: c.name }))}
      />
    );
  }

  if (type === "multiSelect" || type === "linkToRecord") {
    // hasAny/hasAll take an array — a compact toggle list is clearer here
    // than trying to reuse the single-value Select.
    const choices = type === "multiSelect" ? ((field.options.choices as Choice[]) ?? []) : [];
    const selected = Array.isArray(value) ? (value as string[]) : [];
    function toggle(id: string) {
      onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
    }
    if (choices.length === 0) {
      return <span className="text-[12px] text-[var(--color-fg-subtle)]">No options to choose from yet</span>;
    }
    return (
      <div className="flex max-w-[280px] flex-wrap gap-1">
        {choices.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => toggle(c.id)}
            className="rounded-full px-2 py-0.5 text-[11.5px] font-medium transition-opacity"
            style={{ ...chipStyle(c.id), opacity: selected.includes(c.id) ? 1 : 0.4 }}
          >
            {c.name}
          </button>
        ))}
      </div>
    );
  }

  if (type === "number" || type === "autoNumber") {
    return (
      <input
        type="number"
        value={(value as number) ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        className="w-24 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-[12.5px] outline-none focus:border-[var(--color-accent)]"
      />
    );
  }

  if (type === "date" || type === "dateTime" || type === "createdTime" || type === "lastModifiedTime") {
    return (
      <input
        type={type === "dateTime" ? "datetime-local" : "date"}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-[12.5px] outline-none focus:border-[var(--color-accent)]"
      />
    );
  }

  return (
    <input
      type="text"
      value={(value as string) ?? ""}
      onChange={(e) => onChange(e.target.value || undefined)}
      placeholder="Value"
      className="w-40 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-[12.5px] outline-none focus:border-[var(--color-accent)]"
    />
  );
}
