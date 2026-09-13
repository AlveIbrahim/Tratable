"use client";

import { useState } from "react";
import type { FieldType } from "@tratable/shared";
import { useCreateField } from "@/lib/hooks/use-fields";
import { Select } from "@/components/ui/select";

const FIELD_TYPE_OPTIONS: { value: FieldType; label: string }[] = [
  { value: "singleLineText", label: "Single line text" },
  { value: "longText", label: "Long text" },
  { value: "number", label: "Number" },
  { value: "checkbox", label: "Checkbox" },
  { value: "singleSelect", label: "Single select" },
  { value: "multiSelect", label: "Multiple select" },
  { value: "date", label: "Date" },
  { value: "dateTime", label: "Date & time" },
  { value: "email", label: "Email" },
  { value: "url", label: "URL" },
  { value: "phone", label: "Phone" },
];

export function AddFieldButton({ tableId }: { tableId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<FieldType>("singleLineText");
  const createField = useCreateField(tableId);

  // Select fields start with zero choices — no options form here. The cell
  // editor (select-cell-editor.tsx) grows the list on demand: type a value
  // that doesn't exist yet, hit "Add option", and it's added to the field
  // for every future row. That's the only place choices are defined, so
  // creating the field itself needs nothing beyond a name and a type.
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await createField.mutateAsync({ name: name.trim(), type });
    setName("");
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex h-full w-full items-center justify-center text-sm text-[var(--color-muted)] hover:bg-black/5 dark:hover:bg-white/5"
      >
        + Field
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="absolute z-20 w-64 space-y-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)] p-3 shadow-lg"
    >
      <input
        autoFocus
        placeholder="Field name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded border border-[var(--color-border)] bg-transparent px-2 py-1.5 text-sm outline-none focus:border-[var(--color-accent)]"
      />
      <Select value={type} onChange={(v) => setType(v as FieldType)} options={FIELD_TYPE_OPTIONS} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="px-2 py-1 text-sm text-[var(--color-muted)]">
          Cancel
        </button>
        <button
          type="submit"
          disabled={createField.isPending || !name.trim()}
          className="rounded bg-[var(--color-accent)] px-3 py-1 text-sm font-medium text-[var(--color-accent-fg)] disabled:opacity-50"
        >
          Create
        </button>
      </div>
    </form>
  );
}
