/**
 * The field-type registry contract.
 *
 * Every field type (packages/shared/src/fields/definitions/*) implements this
 * interface exactly once. CSV import, CSV export, write-time validation, the
 * query compiler, and every UI cell renderer/editor all dispatch through it —
 * this is the one place a new field type is defined.
 */

export type FieldType =
  | "singleLineText"
  | "longText"
  | "number"
  | "checkbox"
  | "singleSelect"
  | "multiSelect"
  | "date"
  | "dateTime"
  | "email"
  | "url"
  | "phone"
  | "attachment"
  | "linkToRecord"
  | "autoNumber"
  | "createdTime"
  | "lastModifiedTime";

export type FilterOp =
  | "eq"
  | "neq"
  | "contains"
  | "notContains"
  | "startsWith"
  | "endsWith"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "isEmpty"
  | "isNotEmpty"
  | "hasAny"
  | "hasAll"
  | "isChecked"
  | "isUnchecked";

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<T>(error: string): Result<T> {
  return { ok: false, error };
}

/** A raw, already-parameterized SQL fragment produced by a field type's SQL hooks. */
export interface RawSql {
  sql: string;
  params: unknown[];
}

export interface ImportCtx {
  /** Field IDs of any linked-record fields, keyed by linked table's primary-field values already seen in this import, for resolving link references by display value. */
  linkResolvers?: Record<string, Map<string, string>>;
  dateFormatHint?: string;
}

export interface ExportCtx {
  /** Resolves a set of linked record IDs to their primary-field display values. */
  resolveLinkLabels?: (recordIds: string[]) => string[];
  /** Resolves select option IDs to their display names. */
  resolveOptionLabels?: (optionIds: string[]) => string[];
}

export interface FieldTypeDef<TValue = unknown, TOptions = Record<string, unknown>> {
  type: FieldType;
  label: string;
  defaultOptions: TOptions;
  supportedOps: FilterOp[];

  /** Validate + coerce a value coming from the API (record create/update). */
  validate(value: unknown, opts: TOptions): Result<TValue | null>;

  /** Parse one raw CSV cell string into this field's value. */
  parseFromCsv(raw: string, opts: TOptions, ctx: ImportCtx): Result<TValue | null>;

  /** Render a stored value back out to a CSV cell string. */
  formatToCsv(value: TValue | null, opts: TOptions, ctx: ExportCtx): string;

  /**
   * Given a column of raw CSV sample strings, guess whether this type fits
   * and with what options. Returns null if this type is not a plausible match.
   * confidence is 0..1; the importer picks the highest-confidence match,
   * trying types in a fixed priority order (see fields/infer.ts).
   */
  inferFromSamples(samples: string[]): { options: TOptions; confidence: number } | null;

  /** SQL fragment to sort by this field, ascending (caller negates for desc). */
  sortExpr(fieldId: string): RawSql;

  /** SQL fragment for a WHERE clause given an operator + operand. */
  filterExpr(fieldId: string, op: FilterOp, operand: unknown): RawSql;
}
