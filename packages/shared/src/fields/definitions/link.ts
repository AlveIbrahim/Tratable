import { err, FieldTypeDef, ok } from "../types";

export interface LinkOptions {
  linkedTableId: string;
  symmetricFieldId?: string;
  allowMultiple?: boolean;
}

export const linkToRecordField: FieldTypeDef<string[], LinkOptions> = {
  type: "linkToRecord",
  label: "Link to record",
  defaultOptions: { linkedTableId: "", allowMultiple: true },
  supportedOps: ["hasAny", "hasAll", "isEmpty", "isNotEmpty"],

  validate(value, opts) {
    if (value === null || value === undefined) return ok([]);
    if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) {
      return err("Expected an array of record ids");
    }
    if (!opts.allowMultiple && value.length > 1) {
      return err("This link field only allows a single linked record");
    }
    return ok(value as string[]);
  },

  // Resolving display names -> record ids requires a DB lookup against the
  // linked table, which the pure shared package cannot do. The import
  // executor (apps/api) pre-resolves labels via ctx.linkResolvers before
  // calling this, keyed by field id -> Map<label, recordId>.
  parseFromCsv(raw, opts, ctx) {
    const trimmed = raw.trim();
    if (trimmed === "") return ok([]);
    const labels = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
    const resolver = ctx.linkResolvers?.[opts.linkedTableId];
    if (!resolver) return err("Link resolution context missing for this field");
    const ids: string[] = [];
    for (const label of labels) {
      const id = resolver.get(label);
      if (!id) return err(`No record found in linked table matching "${label}"`);
      ids.push(id);
    }
    return ok(ids);
  },

  formatToCsv(value, _opts, ctx) {
    if (!value || value.length === 0) return "";
    if (ctx.resolveLinkLabels) return ctx.resolveLinkLabels(value).join(", ");
    return value.join(", ");
  },

  inferFromSamples() {
    // Link fields are never auto-inferred from a bare CSV column — creating
    // one requires picking a target table, which the import UI does explicitly.
    return null;
  },

  sortExpr(fieldId) {
    return { sql: `jsonb_array_length(COALESCE(data->'${fieldId}', '[]'::jsonb))`, params: [] };
  },

  filterExpr(fieldId, op, operand) {
    const col = `data->'${fieldId}'`;
    switch (op) {
      case "hasAny":
        return { sql: `${col} ?| ?::text[]`, params: [operand] };
      case "hasAll":
        return { sql: `${col} ?& ?::text[]`, params: [operand] };
      case "isEmpty":
        return { sql: `(${col} IS NULL OR jsonb_array_length(${col}) = 0)`, params: [] };
      case "isNotEmpty":
        return { sql: `(${col} IS NOT NULL AND jsonb_array_length(${col}) > 0)`, params: [] };
      default:
        throw new Error(`Unsupported op ${op} for linkToRecord`);
    }
  },
};
