import { makeId } from "../../ids";
import { err, FieldTypeDef, ok } from "../types";

export interface SelectChoice {
  id: string;
  name: string;
  color?: string;
}

export interface SelectOptions {
  choices: SelectChoice[];
}

function findChoiceByName(choices: SelectChoice[], name: string): SelectChoice | undefined {
  const lower = name.trim().toLowerCase();
  return choices.find((c) => c.name.toLowerCase() === lower);
}

export const singleSelectField: FieldTypeDef<string, SelectOptions> = {
  type: "singleSelect",
  label: "Single select",
  defaultOptions: { choices: [] },
  supportedOps: ["eq", "neq", "isEmpty", "isNotEmpty"],

  validate(value, opts) {
    if (value === null || value === undefined || value === "") return ok(null);
    if (typeof value !== "string") return err("Expected a choice id");
    if (!opts.choices.some((c) => c.id === value)) return err(`Unknown choice id "${value}"`);
    return ok(value);
  },

  parseFromCsv(raw, opts) {
    const trimmed = raw.trim();
    if (trimmed === "") return ok(null);
    const existing = findChoiceByName(opts.choices, trimmed);
    if (existing) return ok(existing.id);
    // New choice: caller (import executor) is responsible for persisting it
    // to field options before writing the record; here we return a synthetic
    // id so the row-level parse pass can proceed without a second lookup pass.
    return ok(`__new__:${trimmed}`);
  },

  formatToCsv(value, opts, ctx) {
    if (!value) return "";
    if (ctx.resolveOptionLabels) return ctx.resolveOptionLabels([value])[0] ?? "";
    return opts.choices.find((c) => c.id === value)?.name ?? "";
  },

  inferFromSamples(samples) {
    const nonEmpty = samples.map((s) => s.trim()).filter((s) => s !== "");
    if (nonEmpty.length === 0) return null;
    const distinct = new Set(nonEmpty);
    const ratio = distinct.size / nonEmpty.length;
    if (distinct.size > 20 || ratio > 0.5) return null;
    const choices: SelectChoice[] = [...distinct].map((name) => ({ id: makeId("option"), name }));
    return { options: { choices }, confidence: 0.7 };
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
      case "isEmpty":
        return { sql: `(${col} IS NULL OR ${col} = '')`, params: [] };
      case "isNotEmpty":
        return { sql: `(${col} IS NOT NULL AND ${col} != '')`, params: [] };
      default:
        throw new Error(`Unsupported op ${op} for singleSelect`);
    }
  },
};

export const multiSelectField: FieldTypeDef<string[], SelectOptions> = {
  type: "multiSelect",
  label: "Multiple select",
  defaultOptions: { choices: [] },
  supportedOps: ["hasAny", "hasAll", "isEmpty", "isNotEmpty"],

  validate(value, opts) {
    if (value === null || value === undefined) return ok([]);
    if (!Array.isArray(value)) return err("Expected an array of choice ids");
    for (const v of value) {
      if (typeof v !== "string" || !opts.choices.some((c) => c.id === v)) {
        return err(`Unknown choice id "${v}"`);
      }
    }
    return ok(value as string[]);
  },

  parseFromCsv(raw, opts) {
    const trimmed = raw.trim();
    if (trimmed === "") return ok([]);
    const names = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
    const ids = names.map((name) => findChoiceByName(opts.choices, name)?.id ?? `__new__:${name}`);
    return ok(ids);
  },

  formatToCsv(value, opts, ctx) {
    if (!value || value.length === 0) return "";
    if (ctx.resolveOptionLabels) return ctx.resolveOptionLabels(value).join(", ");
    return value.map((id) => opts.choices.find((c) => c.id === id)?.name ?? "").join(", ");
  },

  inferFromSamples(samples) {
    const nonEmpty = samples.map((s) => s.trim()).filter((s) => s !== "");
    if (nonEmpty.length === 0) return null;
    const hasCommaLists = nonEmpty.filter((s) => s.includes(",")).length / nonEmpty.length;
    if (hasCommaLists < 0.3) return null;
    const allValues = new Set(nonEmpty.flatMap((s) => s.split(",").map((x) => x.trim())));
    if (allValues.size > 40) return null;
    const choices: SelectChoice[] = [...allValues].map((name) => ({ id: makeId("option"), name }));
    return { options: { choices }, confidence: 0.55 };
  },

  sortExpr(fieldId) {
    // Sorting a multi-value field by count is the least surprising default.
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
        throw new Error(`Unsupported op ${op} for multiSelect`);
    }
  },
};
