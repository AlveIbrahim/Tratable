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

const SELECT_TYPES: FieldType[] = ["singleSelect", "multiSelect"];

function parseChoiceNames(raw: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const part of raw.split(",")) {
    const name = part.trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    names.push(name);
  }
  return names;
}

export function AddFieldButton({ tableId }: { tableId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<FieldType>("singleLineText");
  // A select field created with no choices has nothing to ever pick — the
  // cell editor renders an empty list forever until someone edits the
  // field's options later (no such UI exists yet). Asking for choices up
  // front at creation time is what makes select types usable at all.
  const [choicesRaw, setChoicesRaw] = useState("");
  const createField = useCreateField(tableId);

  const isSelectType = SELECT_TYPES.includes(type);
  const choiceNames = parseChoiceNames(choicesRaw);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (isSelectType && choiceNames.length === 0) return;

    const options = isSelectType
      ? { choices: choiceNames.map((n) => ({ id: crypto.randomUUID(), name: n })) }
      : undefined;

    await createField.mutateAsync({ name: name.trim(), type, options });
    setName("");
    setChoicesRaw("");
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
      className="absolute z-20 w-72 space-y-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)] p-3 shadow-lg"
    >
      <input
        autoFocus
        placeholder="Field name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded border border-[var(--color-border)] bg-transparent px-2 py-1.5 text-sm outline-none focus:border-[var(--color-accent)]"
      />
      <Select value={type} onChange={(v) => setType(v as FieldType)} options={FIELD_TYPE_OPTIONS} />
      {isSelectType && (
        <div className="space-y-1">
          <input
            placeholder="Options, comma separated (e.g. Open, Closed, Pending)"
            value={choicesRaw}
            onChange={(e) => setChoicesRaw(e.target.value)}
            className="w-full rounded border border-[var(--color-border)] bg-transparent px-2 py-1.5 text-sm outline-none focus:border-[var(--color-accent)]"
          />
          {choiceNames.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {choiceNames.map((n) => (
                <span key={n} className="rounded bg-black/5 px-1.5 py-0.5 text-xs dark:bg-white/10">
                  {n}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="px-2 py-1 text-sm text-[var(--color-muted)]">
          Cancel
        </button>
        <button
          type="submit"
          disabled={createField.isPending || (isSelectType && choiceNames.length === 0)}
          className="rounded bg-[var(--color-accent)] px-3 py-1 text-sm font-medium text-[var(--color-accent-fg)] disabled:opacity-50"
        >
          Create
        </button>
      </div>
    </form>
  );
}
