import { err, FieldTypeDef, ok } from "../types";

export interface NumberOptions {
  precision?: number; // decimal places, default 0
  format?: "decimal" | "integer" | "currency" | "percent";
  currencySymbol?: string;
}

const NUMERIC_RE = /^-?(\d{1,3}(,\d{3})*|\d+)(\.\d+)?%?$/;

function toRawNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(/[$,€£]/g, "").replace(/%$/, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export const numberField: FieldTypeDef<number, NumberOptions> = {
  type: "number",
  label: "Number",
  defaultOptions: { precision: 0, format: "decimal" },
  supportedOps: ["eq", "neq", "gt", "gte", "lt", "lte", "isEmpty", "isNotEmpty"],

  validate(value, opts) {
    if (value === null || value === undefined || value === "") return ok(null);
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return err("Expected a number");
    const precision = opts.precision ?? 0;
    return ok(Number(n.toFixed(precision)));
  },

  parseFromCsv(raw, opts) {
    if (raw.trim() === "") return ok(null);
    const n = toRawNumber(raw);
    if (n === null) return err(`"${raw}" is not a valid number`);
    const precision = opts.precision ?? 0;
    return ok(Number(n.toFixed(precision)));
  },

  formatToCsv(value, opts) {
    if (value === null || value === undefined) return "";
    const precision = opts.precision ?? 0;
    const fixed = value.toFixed(precision);
    if (opts.format === "percent") return `${fixed}%`;
    if (opts.format === "currency") return `${opts.currencySymbol ?? "$"}${fixed}`;
    return fixed;
  },

  inferFromSamples(samples) {
    const nonEmpty = samples.filter((s) => s.trim() !== "");
    if (nonEmpty.length === 0) return null;
    const matches = nonEmpty.filter((s) => NUMERIC_RE.test(s.trim()));
    if (matches.length / nonEmpty.length < 0.9) return null;
    const isPercent = matches.every((s) => s.trim().endsWith("%"));
    const isCurrency = matches.some((s) => /[$€£]/.test(s));
    const hasDecimals = matches.some((s) => s.includes("."));
    return {
      options: {
        precision: hasDecimals ? 2 : 0,
        format: isPercent ? "percent" : isCurrency ? "currency" : "decimal",
      },
      confidence: 0.95,
    };
  },

  sortExpr(fieldId) {
    return {
      sql: `JSON_VALUE(data, '$."${fieldId}"' RETURNING numeric NULL ON ERROR)`,
      params: [],
    };
  },

  filterExpr(fieldId, op, operand) {
    const col = `JSON_VALUE(data, '$."${fieldId}"' RETURNING numeric NULL ON ERROR)`;
    switch (op) {
      case "eq":
        return { sql: `${col} = ?`, params: [operand] };
      case "neq":
        return { sql: `(${col} IS DISTINCT FROM ?)`, params: [operand] };
      case "gt":
        return { sql: `${col} > ?`, params: [operand] };
      case "gte":
        return { sql: `${col} >= ?`, params: [operand] };
      case "lt":
        return { sql: `${col} < ?`, params: [operand] };
      case "lte":
        return { sql: `${col} <= ?`, params: [operand] };
      case "isEmpty":
        return { sql: `${col} IS NULL`, params: [] };
      case "isNotEmpty":
        return { sql: `${col} IS NOT NULL`, params: [] };
      default:
        throw new Error(`Unsupported op ${op} for number`);
    }
  },
};
