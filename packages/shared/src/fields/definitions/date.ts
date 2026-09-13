import { err, FieldTypeDef, ok } from "../types";

export interface DateOptions {
  includeTime?: boolean;
  dateFormat?: string; // display hint only, e.g. "YYYY-MM-DD"
  timeZone?: string;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function tryParseDate(raw: string): Date | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const d = new Date(trimmed);
  if (!Number.isNaN(d.getTime())) return d;
  // Common non-ISO formats: MM/DD/YYYY, DD-MM-YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, mm, dd, yyyy] = slashMatch;
    const d2 = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    if (!Number.isNaN(d2.getTime())) return d2;
  }
  return null;
}

function makeDateType(type: "date" | "dateTime"): FieldTypeDef<string, DateOptions> {
  return {
    type,
    label: type === "date" ? "Date" : "Date & time",
    defaultOptions: { includeTime: type === "dateTime" },
    supportedOps: ["eq", "neq", "gt", "gte", "lt", "lte", "isEmpty", "isNotEmpty"],

    validate(value) {
      if (value === null || value === undefined || value === "") return ok(null);
      if (typeof value !== "string") return err("Expected an ISO date string");
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return err(`"${value}" is not a valid date`);
      return ok(type === "date" ? value.slice(0, 10) : d.toISOString());
    },

    parseFromCsv(raw) {
      if (raw.trim() === "") return ok(null);
      const d = tryParseDate(raw);
      if (!d) return err(`"${raw}" is not a recognized date`);
      return ok(type === "date" ? d.toISOString().slice(0, 10) : d.toISOString());
    },

    formatToCsv(value, opts) {
      if (!value) return "";
      if (type === "date") return value.slice(0, 10);
      return opts.includeTime ? value : value.slice(0, 10);
    },

    inferFromSamples(samples) {
      const nonEmpty = samples.map((s) => s.trim()).filter((s) => s !== "");
      if (nonEmpty.length === 0) return null;
      const parsed = nonEmpty.map(tryParseDate);
      const successRate = parsed.filter(Boolean).length / nonEmpty.length;
      if (successRate < 0.9) return null;
      const isoDateOnly = nonEmpty.every((s) => ISO_DATE_RE.test(s));
      const hasTimeComponent = nonEmpty.some((s) => /\d{1,2}:\d{2}/.test(s));
      return {
        options: { includeTime: hasTimeComponent && type === "dateTime" },
        confidence: isoDateOnly ? 0.9 : 0.75,
      };
    },

    sortExpr(fieldId) {
      return {
        sql: `JSON_VALUE(data, '$."${fieldId}"' RETURNING timestamptz NULL ON ERROR)`,
        params: [],
      };
    },

    filterExpr(fieldId, op, operand) {
      const col = `JSON_VALUE(data, '$."${fieldId}"' RETURNING timestamptz NULL ON ERROR)`;
      switch (op) {
        case "eq":
          return { sql: `${col} = ?::timestamptz`, params: [operand] };
        case "neq":
          return { sql: `(${col} IS DISTINCT FROM ?::timestamptz)`, params: [operand] };
        case "gt":
          return { sql: `${col} > ?::timestamptz`, params: [operand] };
        case "gte":
          return { sql: `${col} >= ?::timestamptz`, params: [operand] };
        case "lt":
          return { sql: `${col} < ?::timestamptz`, params: [operand] };
        case "lte":
          return { sql: `${col} <= ?::timestamptz`, params: [operand] };
        case "isEmpty":
          return { sql: `${col} IS NULL`, params: [] };
        case "isNotEmpty":
          return { sql: `${col} IS NOT NULL`, params: [] };
        default:
          throw new Error(`Unsupported op ${op} for ${type}`);
      }
    },
  };
}

export const dateField = makeDateType("date");
export const dateTimeField = makeDateType("dateTime");
