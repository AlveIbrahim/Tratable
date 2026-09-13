import { err, FieldTypeDef, ok } from "../types";

interface TextOptions {
  maxLength?: number;
}

function makeTextType(type: "singleLineText" | "longText"): FieldTypeDef<string, TextOptions> {
  return {
    type,
    label: type === "singleLineText" ? "Single line text" : "Long text",
    defaultOptions: {},
    supportedOps: ["eq", "neq", "contains", "notContains", "startsWith", "endsWith", "isEmpty", "isNotEmpty"],

    validate(value, opts) {
      if (value === null || value === undefined || value === "") return ok(null);
      if (typeof value !== "string") return err("Expected a string");
      if (opts.maxLength && value.length > opts.maxLength) {
        return err(`Value exceeds max length of ${opts.maxLength}`);
      }
      return ok(value);
    },

    parseFromCsv(raw) {
      const trimmed = raw.trim();
      return ok(trimmed === "" ? null : raw);
    },

    formatToCsv(value) {
      return value ?? "";
    },

    inferFromSamples(samples) {
      // Fallback type — always matches, lowest priority in fields/infer.ts.
      const hasNewline = samples.some((s) => s.includes("\n") || s.length > 100);
      return { options: {}, confidence: hasNewline && type === "longText" ? 0.6 : 0.3 };
    },

    sortExpr(fieldId) {
      return { sql: `data->>'${fieldId}'`, params: [] };
    },

    filterExpr(fieldId, op, operand) {
      const col = `data->>'${fieldId}'`;
      switch (op) {
        case "eq":
          return { sql: `${col} = ?`, params: [operand] };
        case "neq":
          return { sql: `(${col} IS DISTINCT FROM ?)`, params: [operand] };
        case "contains":
          return { sql: `${col} ILIKE '%' || ? || '%'`, params: [operand] };
        case "notContains":
          return { sql: `(${col} IS NULL OR ${col} NOT ILIKE '%' || ? || '%')`, params: [operand] };
        case "startsWith":
          return { sql: `${col} ILIKE ? || '%'`, params: [operand] };
        case "endsWith":
          return { sql: `${col} ILIKE '%' || ?`, params: [operand] };
        case "isEmpty":
          return { sql: `(${col} IS NULL OR ${col} = '')`, params: [] };
        case "isNotEmpty":
          return { sql: `(${col} IS NOT NULL AND ${col} != '')`, params: [] };
        default:
          throw new Error(`Unsupported op ${op} for ${type}`);
      }
    },
  };
}

export const singleLineTextField = makeTextType("singleLineText");
export const longTextField = makeTextType("longText");
