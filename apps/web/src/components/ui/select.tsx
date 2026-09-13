"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon } from "./icons";

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * A custom-rendered dropdown, not a native <select>. Native <select>'s
 * *popup list* is drawn by the OS toolkit on Linux Chrome (GTK) rather
 * than the page — `color-scheme` restyles the closed control but the
 * platform ignores the page's CSS for the popup rows entirely, so a dark
 * page gets a stray light-themed options list no CSS can reach. Rendering
 * the list ourselves sidesteps the platform widget altogether and matches
 * every other themed control in the app.
 */
export function Select({
  value,
  onChange,
  options,
  placeholder,
  className,
  autoOpen,
  onClose,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  /** Opens immediately on mount — used when this Select IS the editor
   * (e.g. a grid cell that just entered edit mode), where a user shouldn't
   * have to click twice to see choices. */
  autoOpen?: boolean;
  /** Fired when the list closes without a selection (outside click) — lets
   * a cell editor exit edit mode instead of just silently closing the list. */
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(!!autoOpen);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        onClose?.();
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [onClose]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-2 text-left text-[13px] outline-none transition-colors focus:border-[var(--color-accent)]"
      >
        <span className={selected ? "" : "text-[var(--color-fg-subtle)]"}>
          {selected?.label ?? placeholder ?? "Select…"}
        </span>
        <ChevronDownIcon width={13} height={13} className="shrink-0 text-[var(--color-fg-subtle)]" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-60 overflow-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-raised)] py-1 shadow-[var(--shadow-lg)]">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`block w-full px-2.5 py-1.5 text-left text-[13px] hover:bg-[var(--color-surface-hover)] ${
                opt.value === value ? "bg-[var(--color-accent-soft)] font-medium text-[var(--color-accent)]" : ""
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
