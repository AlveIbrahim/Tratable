import { err, FieldTypeDef, ok } from "../types";

const TRUE_STRINGS = new Set(["true", "1", "yes", "y", "checked", "x"]);
const FALSE_STRINGS = new Set(["false", "0", "no", "n", "", "unchecked"]);

export const checkboxField: FieldTypeDef<boolean, Record<string, never>> = {
  type: "checkbox",
  label: "Checkbox",
  defaultOptions: {},
  supportedOps: ["isChecked", "isUnchecked"],

  validate(value) {
    if (value === null || value === undefined) return ok(false);
    if (typeof value !== "boolean") return err("Expected a boolean");
    return ok(value);
  },

  parseFromCsv(raw) {
    const v = raw.trim().toLowerCase();
    if (TRUE_STRINGS.has(v)) return ok(true);
    if (FALSE_STRINGS.has(v)) return ok(false);
    return err(`"${raw}" is not a recognized boolean`);
  },

  formatToCsv(value) {
    return value ? "true" : "false";
  },

  inferFromSamples(samples) {
    const nonEmpty = samples.map((s) => s.trim().toLowerCase()).filter((s) => s !== "");
    if (nonEmpty.length === 0) return null;
    const allBool = nonEmpty.every((s) => TRUE_STRINGS.has(s) || FALSE_STRINGS.has(s));
    if (!allBool) return null;
    // Require at least one strict boolean token (not just empty-ish) to avoid
    // matching a column of blank cells.
    const strict = nonEmpty.some((s) => ["true", "false", "yes", "no", "checked", "unchecked"].includes(s));
    return strict ? { options: {}, confidence: 0.85 } : null;
  },

  sortExpr(fieldId) {
    return { sql: `(data->'${fieldId}')::boolean`, params: [] };
  },

  filterExpr(fieldId, op) {
    const col = `(data->'${fieldId}')::boolean`;
    if (op === "isChecked") return { sql: `${col} IS TRUE`, params: [] };
    if (op === "isUnchecked") return { sql: `(${col} IS NOT TRUE)`, params: [] };
    throw new Error(`Unsupported op ${op} for checkbox`);
  },
};
