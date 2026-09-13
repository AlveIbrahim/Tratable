import type { FieldType, FilterOp } from "@tratable/shared";

/** Mirrors apps/api/src/query/query-compiler.ts's SUPPORTED_OPS exactly —
 * the UI must never offer an operator the server will reject with 400.
 * Kept as a hand-maintained twin rather than a shared import because one
 * lives in the API's SQL-compilation layer and the other is pure UI
 * metadata (labels, grouping) that has no reason to ship to the server. */
export const OPS_BY_FIELD_TYPE: Record<FieldType, FilterOp[]> = {
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

export const OP_LABELS: Record<FilterOp, string> = {
  eq: "is",
  neq: "is not",
  contains: "contains",
  notContains: "does not contain",
  startsWith: "starts with",
  endsWith: "ends with",
  gt: "is greater than",
  gte: "is on or after",
  lt: "is less than",
  lte: "is on or before",
  isEmpty: "is empty",
  isNotEmpty: "is not empty",
  hasAny: "has any of",
  hasAll: "has all of",
  isChecked: "is checked",
  isUnchecked: "is not checked",
};

/** Operators that take no value at all (rendered with no value input). */
export const NO_VALUE_OPS: Set<FilterOp> = new Set(["isEmpty", "isNotEmpty", "isChecked", "isUnchecked"]);

/** Field types with a bounded, meaningful set of choices — the only types
 * "Group by" and "Color by" make sense for. Attachments and links carry no
 * single value to bucket or tint rows by. */
export const GROUPABLE_TYPES: FieldType[] = [
  "singleLineText", "longText", "number", "checkbox", "singleSelect",
  "multiSelect", "date", "dateTime", "email", "url", "phone",
  "autoNumber", "createdTime", "lastModifiedTime",
];
export const COLORABLE_TYPES: FieldType[] = ["singleSelect", "multiSelect"];

/** "A → Z" only makes sense for text — a number/date/checkbox field sorted
 * that way reads as broken even though the underlying ORDER BY is correct.
 * One label pair per field type, keyed off what asc/desc actually mean for
 * that type's values. */
export const SORT_DIRECTION_LABELS: Record<FieldType, { asc: string; desc: string }> = {
  singleLineText: { asc: "A → Z", desc: "Z → A" },
  longText: { asc: "A → Z", desc: "Z → A" },
  email: { asc: "A → Z", desc: "Z → A" },
  url: { asc: "A → Z", desc: "Z → A" },
  phone: { asc: "A → Z", desc: "Z → A" },
  singleSelect: { asc: "A → Z", desc: "Z → A" },
  multiSelect: { asc: "A → Z", desc: "Z → A" },
  linkToRecord: { asc: "A → Z", desc: "Z → A" },
  attachment: { asc: "A → Z", desc: "Z → A" },
  number: { asc: "1 → 9", desc: "9 → 1" },
  autoNumber: { asc: "1 → 9", desc: "9 → 1" },
  date: { asc: "Oldest → Newest", desc: "Newest → Oldest" },
  dateTime: { asc: "Oldest → Newest", desc: "Newest → Oldest" },
  createdTime: { asc: "Oldest → Newest", desc: "Newest → Oldest" },
  lastModifiedTime: { asc: "Oldest → Newest", desc: "Newest → Oldest" },
  checkbox: { asc: "Unchecked → Checked", desc: "Checked → Unchecked" },
};
