"use client";

import { useEffect, useRef, useState } from "react";
import type { FieldSummary } from "@/lib/hooks/use-fields";
import { SelectCellEditor } from "./select-cell-editor";
import { chipStyle } from "@/lib/colors";
import { CheckSquareIcon, LinkIcon, PaperclipIcon } from "@/components/ui/icons";

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
    return null;
  }

  switch (field.type) {
    case "checkbox":
      return value ? (
        <CheckSquareIcon width={15} height={15} className="text-[var(--color-accent)]" />
      ) : null;
    case "singleSelect": {
      const choices = (field.options.choices as SelectChoice[]) ?? [];
      const choice = choices.find((c) => c.id === value);
      if (!choice) return null;
      return (
        <span className="truncate rounded-full px-2 py-0.5 text-[12px] font-medium" style={chipStyle(choice.id)}>
          {choice.name}
        </span>
      );
    }
    case "multiSelect": {
      const choices = (field.options.choices as SelectChoice[]) ?? [];
      const ids = Array.isArray(value) ? (value as string[]) : [];
      return (
        <span className="flex flex-wrap gap-1">
          {ids.map((id) => {
            const choice = choices.find((c) => c.id === id);
            return choice ? (
              <span
                key={id}
                className="shrink-0 truncate rounded-full px-2 py-0.5 text-[12px] font-medium"
                style={chipStyle(choice.id)}
              >
                {choice.name}
              </span>
            ) : null;
          })}
        </span>
      );
    }
    case "linkToRecord":
      return (
        <span className="flex items-center gap-1 text-[var(--color-fg-muted)]">
          <LinkIcon width={12} height={12} />
          {(value as string[]).length}
        </span>
      );
    case "attachment":
      return (
        <span className="flex items-center gap-1 text-[var(--color-fg-muted)]">
          <PaperclipIcon width={12} height={12} />
          {(value as unknown[]).length}
        </span>
      );
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
  tableId,
  value,
  onCommit,
  onCancel,
}: {
  field: FieldSummary;
  tableId: string;
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
        className="h-[15px] w-[15px] accent-[var(--color-accent)]"
      />
    );
  }

  if (field.type === "singleSelect" || field.type === "multiSelect") {
    return (
      <SelectCellEditor
        field={field}
        tableId={tableId}
        value={value as string | string[] | null}
        multi={field.type === "multiSelect"}
        onCommit={onCommit}
        onCancel={onCancel}
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
      className="w-full bg-transparent text-[13px] outline-none"
    />
  );
}
