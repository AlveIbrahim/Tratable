import { z } from "zod";
import { FilterOp } from "../fields/types";

export interface FilterCondition {
  fieldId: string;
  op: FilterOp;
  value?: unknown;
}

export interface FilterGroup {
  conjunction: "and" | "or";
  children: FilterNode[];
}

export type FilterNode = FilterGroup | FilterCondition;

export const filterConditionSchema: z.ZodType<FilterCondition> = z.object({
  fieldId: z.string().min(1),
  op: z.enum([
    "eq", "neq", "contains", "notContains", "startsWith", "endsWith",
    "gt", "gte", "lt", "lte", "isEmpty", "isNotEmpty", "hasAny", "hasAll",
    "isChecked", "isUnchecked",
  ]),
  value: z.unknown().optional(),
});

export const filterNodeSchema: z.ZodType<FilterNode> = z.lazy(() =>
  z.union([
    z.object({
      conjunction: z.enum(["and", "or"]),
      children: z.array(filterNodeSchema).max(50),
    }),
    filterConditionSchema,
  ]),
);

export interface SortSpec {
  fieldId: string;
  direction: "asc" | "desc";
}

export const sortSpecSchema = z.object({
  fieldId: z.string().min(1),
  direction: z.enum(["asc", "desc"]),
});

export function isFilterGroup(node: FilterNode): node is FilterGroup {
  return "conjunction" in node;
}
