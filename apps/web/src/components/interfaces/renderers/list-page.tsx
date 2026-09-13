"use client";

import type { ListPageConfig } from "@tratable/shared";
import type { RendererField, RendererRecord } from "../renderer-types";

function textValue(field: RendererField | undefined, data: Record<string, unknown>): string {
  if (!field) return "";
  const v = data[field.id];
  if (v === null || v === undefined) return "";
  if (field.type === "singleSelect") {
    const choices = (field.options.choices as { id: string; name: string }[]) ?? [];
    return choices.find((c) => c.id === v)?.name ?? "";
  }
  return String(v);
}

/** A vertical list of cards — title (required), optional subtitle, optional
 * image. Deliberately the simplest of the five page types: no columns, no
 * filters UI, just "here are the records, one per row" for a linkable
 * directory-style public page. */
export function ListPageRenderer({
  config,
  fields,
  records,
}: {
  config: ListPageConfig;
  fields: RendererField[];
  records: RendererRecord[];
}) {
  const titleField = fields.find((f) => f.id === config.titleFieldId);
  const subtitleField = fields.find((f) => f.id === config.subtitleFieldId);
  const imageField = fields.find((f) => f.id === config.imageFieldId);

  if (records.length === 0) {
    return <p className="p-6 text-[13px] text-[var(--color-fg-subtle)]">No records</p>;
  }

  return (
    <div className="divide-y divide-[var(--color-border)]">
      {records.map((r) => {
        const attachments = imageField ? (r.data[imageField.id] as { url: string }[] | undefined) : undefined;
        const imageUrl = attachments?.[0]?.url;
        return (
          <div key={r.id} className="flex items-center gap-3 px-4 py-3">
            {imageField && (
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--color-surface)]">
                {imageUrl && <img src={imageUrl} alt="" className="h-full w-full object-cover" />}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-medium">{textValue(titleField, r.data) || "Untitled"}</div>
              {subtitleField && (
                <div className="truncate text-[12.5px] text-[var(--color-fg-muted)]">{textValue(subtitleField, r.data)}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
