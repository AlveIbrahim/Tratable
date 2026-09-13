"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { FieldSummary } from "@/lib/hooks/use-fields";
import { useUpdateField } from "@/lib/hooks/use-fields";
import { chipStyle } from "@/lib/colors";
import { CheckSquareIcon, ListPlusIcon } from "@/components/ui/icons";

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
 *
 * The options list is rendered through a portal into document.body, NOT
 * inline under the cell. A grid cell's wrapper uses Tailwind's `truncate`
 * (overflow: hidden) to keep long text from blowing out the row height —
 * exactly the thing that was silently clipping this list to invisible
 * for every real user, even though it existed in the DOM and looked fine
 * to DOM inspection. A portal escapes that ancestor entirely; position is
 * computed from the input's own on-screen rect instead of relying on
 * normal document flow.
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
  const anchorRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [listPos, setListPos] = useState<{ top: number; left: number; width: number } | null>(null);

  // Local, optimistic copy of the field's choices — updated immediately when
  // a new one is added here, rather than waiting on a refetch of `fields`.
  const [choices, setChoices] = useState<Choice[]>(() => (field.options.choices as Choice[]) ?? []);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>(() =>
    multi ? ((value as string[]) ?? []) : value ? [value as string] : [],
  );

  useLayoutEffect(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (rect) setListPos({ top: rect.bottom, left: rect.left, width: Math.max(rect.width, 224) });
  }, []);

  useEffect(() => {
    anchorRef.current?.focus();
  }, []);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      const target = e.target as Node;
      const insideAnchor = anchorRef.current?.contains(target);
      const insideList = listRef.current?.contains(target);
      if (!insideAnchor && !insideList) commitAndClose();
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
    <>
      <input
        ref={anchorRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Find an option"
        className="w-full bg-transparent text-[13px] outline-none placeholder:text-[var(--color-fg-subtle)]"
      />
      {listPos &&
        createPortal(
          <div
            ref={listRef}
            style={{ position: "fixed", top: listPos.top, left: listPos.left, width: listPos.width }}
            className="z-50 mt-1 max-h-60 overflow-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-raised)] py-1 shadow-[var(--shadow-lg)]"
          >
            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleChoice(c)}
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-[13px] hover:bg-[var(--color-surface-hover)]"
              >
                <span className="flex w-4 shrink-0 items-center justify-center text-[var(--color-accent)]">
                  {selected.includes(c.id) && <CheckSquareIcon width={13} height={13} />}
                </span>
                <span className="truncate rounded-full px-2 py-0.5 text-[12px] font-medium" style={chipStyle(c.id)}>
                  {c.name}
                </span>
              </button>
            ))}
            {canAddOption && (
              <button
                type="button"
                onClick={addOption}
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-[13px] text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-hover)]"
              >
                <ListPlusIcon width={13} height={13} className="shrink-0" />
                Add option:
                <span className="truncate rounded-full bg-[var(--color-surface-hover)] px-2 py-0.5 text-[12px] font-medium text-[var(--color-fg)]">
                  {query.trim()}
                </span>
              </button>
            )}
            {filtered.length === 0 && !canAddOption && (
              <div className="px-2 py-1.5 text-[13px] text-[var(--color-fg-muted)]">
                No options yet — type to add one.
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
