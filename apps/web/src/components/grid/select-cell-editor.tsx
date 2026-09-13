"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FieldSummary } from "@/lib/hooks/use-fields";
import { useUpdateField } from "@/lib/hooks/use-fields";

interface Choice {
  id: string;
  name: string;
}

/**
 * The real single/multi-select cell editor: a search box that filters the
 * field's existing choices, plus an inline "Add option: <query>" row when
 * nothing matches — same pattern as Airtable/Notion. Creating a choice here
 * patches the field's options (so it's available to every future row, not
 * just this cell) and selects it immediately; no separate "field settings"
 * screen is needed to grow a select field's option list over time.
 */
export function SelectCellEditor({
  field,
  tableId,
  value,
  multi,
  onCommit,
  onCancel,
}: {
  field: FieldSummary;
  tableId: string;
  value: string | string[] | null;
  multi: boolean;
  onCommit: (value: string | string[] | null) => void;
  onCancel: () => void;
}) {
  const updateField = useUpdateField(tableId);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Local, optimistic copy of the field's choices — updated immediately when
  // a new one is added here, rather than waiting on a refetch of `fields`.
  const [choices, setChoices] = useState<Choice[]>(() => (field.options.choices as Choice[]) ?? []);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>(() =>
    multi ? ((value as string[]) ?? []) : value ? [value as string] : [],
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        commitAndClose();
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const filtered = useMemo(
    () => choices.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase())),
    [choices, query],
  );
  const exactMatch = choices.some((c) => c.name.toLowerCase() === query.trim().toLowerCase());
  const canAddOption = query.trim().length > 0 && !exactMatch;

  function commitAndClose(finalSelected = selected) {
    if (multi) onCommit(finalSelected.length > 0 ? finalSelected : []);
    else onCommit(finalSelected[0] ?? null);
  }

  function toggleChoice(choice: Choice) {
    if (multi) {
      const next = selected.includes(choice.id)
        ? selected.filter((id) => id !== choice.id)
        : [...selected, choice.id];
      setSelected(next);
      setQuery("");
      // Multi-select stays open so more than one option can be picked.
    } else {
      commitAndClose([choice.id]);
    }
  }

  async function addOption() {
    const name = query.trim();
    if (!name) return;
    const newChoice: Choice = { id: crypto.randomUUID(), name };
    const nextChoices = [...choices, newChoice];
    setChoices(nextChoices);
    updateField.mutate({ fieldId: field.id, options: { choices: nextChoices } });
    toggleChoice(newChoice);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onCancel();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered.length === 1 && !canAddOption) toggleChoice(filtered[0]);
      else if (canAddOption) addOption();
    }
  }

  return (
    <div
      ref={rootRef}
      className="absolute left-0 top-0 z-30 w-64 rounded border border-[var(--color-border)] bg-[var(--color-bg)] shadow-lg"
    >
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Find an option"
        className="w-full border-b border-[var(--color-border)] bg-transparent px-2 py-1.5 text-sm outline-none"
      />
      <div className="max-h-52 overflow-auto py-1">
        {filtered.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => toggleChoice(c)}
            className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
          >
            <span className="w-3 shrink-0">{selected.includes(c.id) ? "✓" : ""}</span>
            <span className="truncate rounded bg-black/5 px-1.5 py-0.5 text-xs dark:bg-white/10">{c.name}</span>
          </button>
        ))}
        {canAddOption && (
          <button
            type="button"
            onClick={addOption}
            className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm text-[var(--color-muted)] hover:bg-black/5 dark:hover:bg-white/10"
          >
            Add option:
            <span className="truncate rounded bg-black/5 px-1.5 py-0.5 text-xs dark:bg-white/10">{query.trim()}</span>
          </button>
        )}
        {filtered.length === 0 && !canAddOption && (
          <div className="px-2 py-1.5 text-sm text-[var(--color-muted)]">No options yet — type to add one.</div>
        )}
      </div>
    </div>
  );
}
