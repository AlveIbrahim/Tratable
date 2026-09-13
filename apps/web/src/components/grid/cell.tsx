"use client";

import { useEffect, useRef, useState } from "react";
import type { FieldSummary } from "@/lib/hooks/use-fields";
import { Select } from "@/components/ui/select";

interface SelectChoice {
  id: string;
  name: string;
  color?: string;
}

/** Read-only rendering of a cell's value — one branch per field type,
 * dispatched the same way the shared field registry's formatToCsv does
 * (kept as a parallel switch here rather than importing formatToCsv
 * directly, since the display format for a grid cell and a CSV cell
 * differ slightly — e.g. checkboxes render as a box, not "true"/"false"). */
export function CellDisplay({ field, value }: { field: FieldSummary; value: unknown }) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-transparent">—</span>;
  }

  switch (field.type) {
    case "checkbox":
      return <span>{value ? "✓" : ""}</span>;
    case "singleSelect": {
      const choices = (field.options.choices as SelectChoice[]) ?? [];
      const choice = choices.find((c) => c.id === value);
      if (!choice) return null;
      return (
        <span className="rounded bg-black/5 px-1.5 py-0.5 text-xs dark:bg-white/10">{choice.name}</span>
      );
    }
    case "multiSelect": {
      const choices = (field.options.choices as SelectChoice[]) ?? [];
      const ids = Array.isArray(value) ? (value as string[]) : [];
      return (
        <span className="flex gap-1">
          {ids.map((id) => {
            const choice = choices.find((c) => c.id === id);
            return choice ? (
              <span key={id} className="rounded bg-black/5 px-1.5 py-0.5 text-xs dark:bg-white/10">
                {choice.name}
              </span>
            ) : null;
          })}
        </span>
      );
    }
    case "linkToRecord":
      return <span className="text-[var(--color-muted)]">{(value as string[]).length} linked</span>;
    case "attachment":
      return <span className="text-[var(--color-muted)]">{(value as unknown[]).length} file(s)</span>;
    default:
      return <span className="truncate">{String(value)}</span>;
  }
}

/** Editing widget mounted when a cell enters edit mode. Calls onCommit with
 * the new value on blur/Enter, onCancel on Escape. One branch per field
 * type — this is the UI half of the field-type registry in packages/shared;
 * the validation/CSV halves live there, this only needs to know how to
 * present an input. */
export function CellEditor({
  field,
  value,
  onCommit,
  onCancel,
}: {
  field: FieldSummary;
  value: unknown;
  onCommit: (value: unknown) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement | HTMLSelectElement>(null);

  useEffect(() => {
    ref.current?.focus();
    if (ref.current instanceof HTMLInputElement) ref.current.select();
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") onCancel();
  }

  if (field.type === "checkbox") {
    return (
      <input
        ref={ref as any}
        type="checkbox"
        defaultChecked={Boolean(value)}
        onBlur={(e) => onCommit(e.target.checked)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onCommit((e.target as HTMLInputElement).checked);
          onKeyDown(e);
        }}
        className="h-4 w-4"
      />
    );
  }

  if (field.type === "singleSelect") {
    const choices = (field.options.choices as SelectChoice[]) ?? [];
    return (
      <Select
        autoOpen
        value={(value as string) ?? ""}
        onChange={(v) => onCommit(v || null)}
        onClose={onCancel}
        placeholder=""
        options={choices.map((c) => ({ value: c.id, label: c.name }))}
      />
    );
  }

  const inputType =
    field.type === "number"
      ? "number"
      : field.type === "date"
        ? "date"
        : field.type === "dateTime"
          ? "datetime-local"
          : field.type === "email"
            ? "email"
            : field.type === "url"
              ? "url"
              : "text";

  return (
    <input
      ref={ref as any}
      type={inputType}
      defaultValue={(value as string | number) ?? ""}
      onBlur={(e) => onCommit(inputType === "number" ? Number(e.target.value) || null : e.target.value || null)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          onCommit(inputType === "number" ? Number((e.target as HTMLInputElement).value) || null : (e.target as HTMLInputElement).value || null);
        }
        onKeyDown(e);
      }}
      className="w-full bg-transparent text-sm outline-none"
    />
  );
}
