"use client";

import type { RecordDetailPageConfig } from "@tratable/shared";
import type { RendererField, RendererRecord } from "../renderer-types";
import { CellDisplay } from "@/components/grid/cell";

/** A single record laid out as labeled sections — each section is a titled
 * group of field/value pairs, in the order the builder configured them.
 * Read-only in v1, same as the grid page (see grid-page.tsx's note on why
 * writes aren't wired up yet). */
export function RecordDetailPageRenderer({
  config,
  fields,
  record,
}: {
  config: RecordDetailPageConfig;
  fields: RendererField[];
  record: RendererRecord | undefined;
}) {
  if (!record) {
    return <p className="p-6 text-[13px] text-[var(--color-fg-subtle)]">Record not found.</p>;
  }
  const fieldById = (id: string) => fields.find((f) => f.id === id);

  return (
    <div className="space-y-6 p-6">
      {config.sections.map((section, idx) => (
        <div key={idx}>
          <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--color-fg-subtle)]">
            {section.title}
          </h3>
          <div className="space-y-3 rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
            {section.fieldIds.map((fieldId) => {
              const field = fieldById(fieldId);
              if (!field) return null;
              return (
                <div key={fieldId} className="grid grid-cols-3 gap-3 text-[13px]">
                  <div className="text-[var(--color-fg-muted)]">{field.name}</div>
                  <div className="col-span-2">
                    <CellDisplay field={field} value={record.data[fieldId]} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
