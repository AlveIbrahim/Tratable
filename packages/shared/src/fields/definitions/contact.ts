import { err, FieldTypeDef, ok } from "../types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/[^\s]+\.[^\s]+$/i;
const PHONE_RE = /^[+()\d][\d\s().-]{5,}$/;

function makeContactType(
  type: "email" | "url" | "phone",
  re: RegExp,
  label: string,
): FieldTypeDef<string, Record<string, never>> {
  return {
    type,
    label,
    defaultOptions: {},
    supportedOps: ["eq", "neq", "contains", "isEmpty", "isNotEmpty"],

    validate(value) {
      if (value === null || value === undefined || value === "") return ok(null);
      if (typeof value !== "string") return err(`Expected a ${type} string`);
      if (!re.test(value.trim())) return err(`"${value}" is not a valid ${type}`);
      return ok(value.trim());
    },

    parseFromCsv(raw) {
      const trimmed = raw.trim();
      if (trimmed === "") return ok(null);
      if (!re.test(trimmed)) return err(`"${raw}" is not a valid ${type}`);
      return ok(trimmed);
    },

    formatToCsv(value) {
      return value ?? "";
    },

    inferFromSamples(samples) {
      const nonEmpty = samples.map((s) => s.trim()).filter((s) => s !== "");
      if (nonEmpty.length === 0) return null;
      const matchRate = nonEmpty.filter((s) => re.test(s)).length / nonEmpty.length;
      if (matchRate < 0.9) return null;
      return { options: {}, confidence: 0.9 };
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

export const emailField = makeContactType("email", EMAIL_RE, "Email");
export const urlField = makeContactType("url", URL_RE, "URL");
export const phoneField = makeContactType("phone", PHONE_RE, "Phone");
