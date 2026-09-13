import { describe, expect, it } from "vitest";
import { getFieldType } from "./registry";
import { inferColumnType } from "./infer";

describe("field registry", () => {
  it("round-trips singleLineText through csv parse/format", () => {
    const def = getFieldType("singleLineText");
    const parsed = def.parseFromCsv("Acme Corp", {}, {});
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(def.formatToCsv(parsed.value, {}, {})).toBe("Acme Corp");
  });

  it("number: parses currency and formats back with precision", () => {
    const def = getFieldType("number");
    const parsed = def.parseFromCsv("$1,234.50", { precision: 2 }, {});
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value).toBe(1234.5);
    expect(def.formatToCsv(1234.5, { precision: 2, format: "currency", currencySymbol: "$" }, {})).toBe("$1234.50");
  });

  it("number: rejects garbage", () => {
    const def = getFieldType("number");
    const parsed = def.parseFromCsv("not a number", {}, {});
    expect(parsed.ok).toBe(false);
  });

  it("checkbox: recognizes common boolean tokens", () => {
    const def = getFieldType("checkbox");
    expect(def.parseFromCsv("Yes", {}, {})).toEqual({ ok: true, value: true });
    expect(def.parseFromCsv("0", {}, {})).toEqual({ ok: true, value: false });
    expect(def.parseFromCsv("maybe", {}, {}).ok).toBe(false);
  });

  it("date: parses ISO and slash formats to ISO output", () => {
    const def = getFieldType("date");
    const iso = def.parseFromCsv("2026-01-15", {}, {});
    expect(iso).toEqual({ ok: true, value: "2026-01-15" });
    const slash = def.parseFromCsv("01/15/2026", {}, {});
    expect(slash.ok).toBe(true);
  });

  it("singleSelect: reuses an existing choice id by name, else marks new", () => {
    const def = getFieldType("singleSelect");
    const opts = { choices: [{ id: "opt_1", name: "Open" }] };
    const existing = def.parseFromCsv("Open", opts, {});
    expect(existing).toEqual({ ok: true, value: "opt_1" });
    const fresh = def.parseFromCsv("Closed", opts, {});
    expect(fresh.ok && (fresh.value as string).startsWith("__new__:")).toBe(true);
  });

  it("filterExpr rejects unsupported ops loudly rather than silently no-op", () => {
    const def = getFieldType("checkbox");
    expect(() => def.filterExpr("fld_x", "contains", "x")).toThrow();
  });
});

describe("type inference", () => {
  it("infers number over text for a numeric column", () => {
    const result = inferColumnType(["1", "2", "3.5", "42"]);
    expect(result.type).toBe("number");
  });

  it("infers checkbox for yes/no columns", () => {
    const result = inferColumnType(["yes", "no", "yes", "no"]);
    expect(result.type).toBe("checkbox");
  });

  it("infers singleSelect for a small repeated category set", () => {
    const result = inferColumnType(["Open", "Closed", "Open", "Open", "Closed", "Pending"]);
    expect(result.type).toBe("singleSelect");
  });

  it("falls back to singleLineText for high-cardinality free text", () => {
    const result = inferColumnType(["Alice Johnson", "Bob Smith", "Carol Lee", "Dave Kim"]);
    expect(result.type).toBe("singleLineText");
  });

  it("infers date for ISO date columns", () => {
    const result = inferColumnType(["2026-01-01", "2026-02-15", "2026-03-30"]);
    expect(result.type).toBe("date");
  });
});
