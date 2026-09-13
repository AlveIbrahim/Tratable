import { err, FieldTypeDef, ok } from "../types";

export interface AttachmentValue {
  id: string;
  filename: string;
  url: string;
  size: number;
  mimeType: string;
}

export const attachmentField: FieldTypeDef<AttachmentValue[], Record<string, never>> = {
  type: "attachment",
  label: "Attachment",
  defaultOptions: {},
  supportedOps: ["isEmpty", "isNotEmpty"],

  validate(value) {
    if (value === null || value === undefined) return ok([]);
    if (!Array.isArray(value)) return err("Expected an array of attachments");
    for (const v of value) {
      if (
        typeof v !== "object" ||
        v === null ||
        typeof (v as AttachmentValue).id !== "string" ||
        typeof (v as AttachmentValue).url !== "string"
      ) {
        return err("Malformed attachment entry");
      }
    }
    return ok(value as AttachmentValue[]);
  },

  // Attachments cannot be created from a bare CSV cell (no file bytes to
  // attach) — a CSV column of URLs is treated as plain text unless the user
  // explicitly maps it to an attachment field, in which case the import
  // executor fetches/stores each URL out of band before calling this.
  parseFromCsv() {
    return err("Attachment columns must be mapped explicitly; URLs are not auto-imported as files");
  },

  formatToCsv(value) {
    if (!value || value.length === 0) return "";
    return value.map((a) => a.url).join(", ");
  },

  inferFromSamples() {
    return null;
  },

  sortExpr(fieldId) {
    return { sql: `jsonb_array_length(COALESCE(data->'${fieldId}', '[]'::jsonb))`, params: [] };
  },

  filterExpr(fieldId, op) {
    const col = `data->'${fieldId}'`;
    if (op === "isEmpty") return { sql: `(${col} IS NULL OR jsonb_array_length(${col}) = 0)`, params: [] };
    if (op === "isNotEmpty") return { sql: `(${col} IS NOT NULL AND jsonb_array_length(${col}) > 0)`, params: [] };
    throw new Error(`Unsupported op ${op} for attachment`);
  },
};
