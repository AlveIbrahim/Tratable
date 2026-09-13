import { err, FieldTypeDef, ok } from "../types";

/**
 * autoNumber, createdTime, lastModifiedTime are server-computed and read-only
 * from the client's point of view. validate() rejects any client-supplied
 * value; the actual value is assigned by the records service on write.
 */

export const autoNumberField: FieldTypeDef<number, Record<string, never>> = {
  type: "autoNumber",
  label: "Auto number",
  defaultOptions: {},
  supportedOps: ["eq", "neq", "gt", "gte", "lt", "lte"],

  validate(value) {
    if (value === null || value === undefined) return ok(null);
    return err("autoNumber is assigned by the server and cannot be set directly");
  },

  parseFromCsv() {
    // Ignored on import — always reassigned server-side.
    return ok(null);
  },

  formatToCsv(value) {
    return value === null || value === undefined ? "" : String(value);
  },

  inferFromSamples() {
    return null;
  },

  sortExpr(fieldId) {
    return { sql: `JSON_VALUE(data, '$."${fieldId}"' RETURNING numeric NULL ON ERROR)`, params: [] };
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
      default:
        throw new Error(`Unsupported op ${op} for autoNumber`);
    }
  },
};

function makeTimestampType(type: "createdTime" | "lastModifiedTime"): FieldTypeDef<string, Record<string, never>> {
  const column = type === "createdTime" ? "created_at" : "updated_at";
  return {
    type,
    label: type === "createdTime" ? "Created time" : "Last modified time",
    defaultOptions: {},
    supportedOps: ["gt", "gte", "lt", "lte"],

    validate() {
      return err(`${type} is computed by the server`);
    },

    parseFromCsv() {
      return ok(null);
    },

    formatToCsv(value) {
      return value ?? "";
    },

    inferFromSamples() {
      return null;
    },

    // These read from the real `records` columns, not `data` — the query
    // compiler special-cases these two types instead of calling sortExpr/
    // filterExpr against a JSONB path.
    sortExpr() {
      return { sql: column, params: [] };
    },

    filterExpr(_fieldId, op, operand) {
      switch (op) {
        case "gt":
          return { sql: `${column} > ?::timestamptz`, params: [operand] };
        case "gte":
          return { sql: `${column} >= ?::timestamptz`, params: [operand] };
        case "lt":
          return { sql: `${column} < ?::timestamptz`, params: [operand] };
        case "lte":
          return { sql: `${column} <= ?::timestamptz`, params: [operand] };
        default:
          throw new Error(`Unsupported op ${op} for ${type}`);
      }
    },
  };
}

export const createdTimeField = makeTimestampType("createdTime");
export const lastModifiedTimeField = makeTimestampType("lastModifiedTime");
