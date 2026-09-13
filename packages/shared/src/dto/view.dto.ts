import { z } from "zod";
import { filterNodeSchema, sortSpecSchema } from "../query/filter";

export const viewConfigSchema = z.object({
  fieldOrder: z.array(z.string()).default([]),
  hiddenFieldIds: z.array(z.string()).default([]),
  filters: filterNodeSchema.optional(),
  sorts: z.array(sortSpecSchema).default([]),
  rowHeight: z.enum(["short", "medium", "tall"]).default("short"),
  groupByFieldId: z.string().optional(),
  /** Tints each row's background by this field's chosen value — restricted
   * client-side to singleSelect/multiSelect (see view-toolbar.tsx), since
   * "color by value" only makes sense for a field with a bounded set of
   * choices. Reuses the same id-hashed chip color as everywhere else in
   * the UI, so a row's tint always matches its own chip's color. */
  colorFieldId: z.string().optional(),
});
export type ViewConfig = z.infer<typeof viewConfigSchema>;

export const createViewSchema = z.object({
  tableId: z.string().min(1),
  name: z.string().min(1).max(120),
  type: z.enum(["grid"]).default("grid"),
  config: viewConfigSchema.partial().optional(),
});
export type CreateViewDto = z.infer<typeof createViewSchema>;

export const updateViewSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  config: viewConfigSchema.partial().optional(),
  pos: z.number().optional(),
});
export type UpdateViewDto = z.infer<typeof updateViewSchema>;
