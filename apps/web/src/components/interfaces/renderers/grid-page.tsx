"use client";

import type { GridPageConfig } from "@tratable/shared";
import type { RendererField, RendererRecord } from "../renderer-types";
import { CellDisplay } from "@/components/grid/cell";

/** Read-only grid — v1's public/preview grid page never allows inline
 * editing (allowEdit/allowCreate/allowDelete on the config are reserved for
 * a later phase; wiring them up means reusing the authenticated write path
 * from an anonymous request, which needs its own allowlist story beyond
 * "read"). Reuses the same CellDisplay the authenticated grid uses, so a
 * chip's color and a checkbox's icon match everywhere in the app. */
export function GridPageRenderer({
  fields,
  records,
}: {
  config: GridPageConfig;
  fields: RendererField[];
  records: RendererRecord[];
}) {
  if (fields.length === 0) {
    return <p className="p-6 text-[13px] text-[var(--color-fg-subtle)]">No fields are visible on this page yet.</p>;
  }
  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
            {fields.map((f) => (
              <th key={f.id} className="px-3 py-2 text-left font-medium text-[var(--color-fg-muted)]">
                {f.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id} className="border-b border-[var(--color-border)]">
              {fields.map((f) => (
                <td key={f.id} className="max-w-64 truncate px-3 py-2">
                  <CellDisplay field={f} value={r.data[f.id]} />
                </td>
              ))}
            </tr>
          ))}
          {records.length === 0 && (
            <tr>
              <td colSpan={fields.length} className="px-3 py-6 text-center text-[var(--color-fg-subtle)]">
                No records
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
