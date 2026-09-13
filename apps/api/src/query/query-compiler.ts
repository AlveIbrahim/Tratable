import { sql, RawBuilder } from "kysely";
import { FieldRow } from "../database/schema";
import { FilterNode, isFilterGroup, SortSpec } from "@tratable/shared";

/**
 * Filter/sort tree -> parameterized SQL, compiled against a specific table's
 * field list. This is the one place client-supplied query shape reaches SQL
 * construction, so three rules are load-bearing:
 *
 *  1. Every fieldId in the tree is checked against `fields` (the caller's
 *     field list for this table) before it touches a query — an unknown id
 *     throws rather than silently being dropped or, worse, interpolated.
 *  2. Every operator is checked against that field type's allowed ops.
 *  3. Every value is bound as a genuine kysely template parameter (`${v}`),
 *     never string-concatenated. kysely parameterizes template interpolations
 *     automatically, so this file only ever builds fragments this way.
 *
 * Numeric/date casts use `JSON_VALUE(... RETURNING numeric NULL ON ERROR)`
 * (Postgres 18+) so a single dirty legacy cell degrades to NULL instead of
 * aborting the whole query with a cast error.
 */

export class QueryCompilerError extends Error {}

function fieldById(fields: FieldRow[], fieldId: string): FieldRow {
  const field = fields.find((f) => f.id === fieldId);
  if (!field) throw new QueryCompilerError(`Unknown field "${fieldId}" for this table`);
  return field;
}

const SUPPORTED_OPS: Record<string, string[]> = {
  singleLineText: ["eq", "neq", "contains", "notContains", "startsWith", "endsWith", "isEmpty", "isNotEmpty"],
  longText: ["eq", "neq", "contains", "notContains", "startsWith", "endsWith", "isEmpty", "isNotEmpty"],
  email: ["eq", "neq", "contains", "isEmpty", "isNotEmpty"],
  url: ["eq", "neq", "contains", "isEmpty", "isNotEmpty"],
  phone: ["eq", "neq", "contains", "isEmpty", "isNotEmpty"],
  number: ["eq", "neq", "gt", "gte", "lt", "lte", "isEmpty", "isNotEmpty"],
  autoNumber: ["eq", "neq", "gt", "gte", "lt", "lte"],
  checkbox: ["isChecked", "isUnchecked"],
  singleSelect: ["eq", "neq", "isEmpty", "isNotEmpty"],
  multiSelect: ["hasAny", "hasAll", "isEmpty", "isNotEmpty"],
  linkToRecord: ["hasAny", "hasAll", "isEmpty", "isNotEmpty"],
  attachment: ["isEmpty", "isNotEmpty"],
  date: ["eq", "neq", "gt", "gte", "lt", "lte", "isEmpty", "isNotEmpty"],
  dateTime: ["eq", "neq", "gt", "gte", "lt", "lte", "isEmpty", "isNotEmpty"],
  createdTime: ["gt", "gte", "lt", "lte"],
  lastModifiedTime: ["gt", "gte", "lt", "lte"],
};

function assertOpSupported(field: FieldRow, op: string) {
  const allowed = SUPPORTED_OPS[field.type];
  if (!allowed || !allowed.includes(op)) {
    throw new QueryCompilerError(`Operator "${op}" is not supported on field type "${field.type}"`);
  }
}

/** JSONB text accessor for a field id. Field ids are validated against the
 * table's own field list before this is ever called — never build this from
 * unchecked client input. */
function textCol(fieldId: string): RawBuilder<string> {
  return sql`data->>${sql.lit(fieldId)}`;
}
function jsonbCol(fieldId: string): RawBuilder<unknown> {
  return sql`data->${sql.lit(fieldId)}`;
}
function numericCol(fieldId: string): RawBuilder<number | null> {
  return sql`JSON_VALUE(data, ${sql.lit(`$."${fieldId}"`)} RETURNING numeric NULL ON ERROR)`;
}
function timestampCol(fieldId: string): RawBuilder<Date | null> {
  return sql`JSON_VALUE(data, ${sql.lit(`$."${fieldId}"`)} RETURNING timestamptz NULL ON ERROR)`;
}

function compileCondition(field: FieldRow, op: string, value: unknown): RawBuilder<boolean> {
  assertOpSupported(field, op);
  const isNumeric = field.type === "number" || field.type === "autoNumber";
  const isTimestamp = field.type === "date" || field.type === "dateTime" || field.type === "createdTime" || field.type === "lastModifiedTime";
  const isMultiValue = field.type === "multiSelect" || field.type === "linkToRecord" || field.type === "attachment";
  const col = isTimestamp
    ? field.type === "createdTime"
      ? sql.raw("created_at")
      : field.type === "lastModifiedTime"
        ? sql.raw("updated_at")
        : timestampCol(field.id)
    : isNumeric
      ? numericCol(field.id)
      : isMultiValue
        ? jsonbCol(field.id)
        : textCol(field.id);

  switch (op) {
    case "eq":
      return isTimestamp ? sql`${col} = ${value}::timestamptz` : sql`${col} = ${value}`;
    case "neq":
      return isTimestamp ? sql`(${col} IS DISTINCT FROM ${value}::timestamptz)` : sql`(${col} IS DISTINCT FROM ${value})`;
    case "gt":
      return isTimestamp ? sql`${col} > ${value}::timestamptz` : sql`${col} > ${value}`;
    case "gte":
      return isTimestamp ? sql`${col} >= ${value}::timestamptz` : sql`${col} >= ${value}`;
    case "lt":
      return isTimestamp ? sql`${col} < ${value}::timestamptz` : sql`${col} < ${value}`;
    case "lte":
      return isTimestamp ? sql`${col} <= ${value}::timestamptz` : sql`${col} <= ${value}`;
    case "contains":
      return sql`${col} ILIKE '%' || ${value} || '%'`;
    case "notContains":
      return sql`(${col} IS NULL OR ${col} NOT ILIKE '%' || ${value} || '%')`;
    case "startsWith":
      return sql`${col} ILIKE ${value} || '%'`;
    case "endsWith":
      return sql`${col} ILIKE '%' || ${value}`;
    case "isEmpty":
      return isMultiValue
        ? sql`(${col} IS NULL OR jsonb_array_length(${col}) = 0)`
        : sql`(${col} IS NULL OR ${col} = '')`;
    case "isNotEmpty":
      return isMultiValue
        ? sql`(${col} IS NOT NULL AND jsonb_array_length(${col}) > 0)`
        : sql`(${col} IS NOT NULL AND ${col} != '')`;
    case "hasAny":
      return sql`${col} ?| ${sql.val(value as string[])}::text[]`;
    case "hasAll":
      return sql`${col} ?& ${sql.val(value as string[])}::text[]`;
    case "isChecked":
      return sql`(data->${sql.lit(field.id)})::boolean IS TRUE`;
    case "isUnchecked":
      return sql`((data->${sql.lit(field.id)})::boolean IS NOT TRUE)`;
    default:
      throw new QueryCompilerError(`Unhandled operator "${op}"`);
  }
}

export function compileFilterTree(node: FilterNode, fields: FieldRow[]): RawBuilder<boolean> {
  if (isFilterGroup(node)) {
    if (node.children.length === 0) return sql`TRUE`;
    const compiled = node.children.map((child) => compileFilterTree(child, fields));
    const joiner = node.conjunction === "and" ? sql` AND ` : sql` OR `;
    return sql`(${sql.join(compiled, joiner)})`;
  }
  const field = fieldById(fields, node.fieldId);
  return compileCondition(field, node.op, node.value);
}

export function compileSortExpr(sortField: FieldRow): RawBuilder<unknown> {
  if (sortField.type === "number" || sortField.type === "autoNumber") return numericCol(sortField.id);
  if (sortField.type === "createdTime") return sql.raw("created_at");
  if (sortField.type === "lastModifiedTime") return sql.raw("updated_at");
  if (sortField.type === "date" || sortField.type === "dateTime") return timestampCol(sortField.id);
  if (sortField.type === "multiSelect" || sortField.type === "linkToRecord" || sortField.type === "attachment") {
    return sql`jsonb_array_length(COALESCE(${jsonbCol(sortField.id)}, '[]'::jsonb))`;
  }
  if (sortField.type === "checkbox") return sql`(${jsonbCol(sortField.id)})::boolean`;
  return textCol(sortField.id);
}

export function compileSorts(sorts: SortSpec[], fields: FieldRow[]): { expr: RawBuilder<unknown>; direction: "asc" | "desc" }[] {
  return sorts.map((s) => ({ expr: compileSortExpr(fieldById(fields, s.fieldId)), direction: s.direction }));
}
