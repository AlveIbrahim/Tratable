import { z } from "zod";
import { filterNodeSchema } from "../query/filter";

const basePageFields = { v: z.literal(1) };

export const gridPageConfigSchema = z.object({
  ...basePageFields,
  type: z.literal("grid"),
  tableId: z.string(),
  viewId: z.string().optional(),
  visibleFieldIds: z.array(z.string()),
  filters: filterNodeSchema.optional(),
  allowEdit: z.boolean().default(false),
  allowCreate: z.boolean().default(false),
  allowDelete: z.boolean().default(false),
});
export type GridPageConfig = z.infer<typeof gridPageConfigSchema>;

export const recordDetailPageConfigSchema = z.object({
  ...basePageFields,
  type: z.literal("record_detail"),
  tableId: z.string(),
  recordSelector: z.enum(["url_param", "picker"]),
  sections: z.array(z.object({ title: z.string(), fieldIds: z.array(z.string()) })),
});
export type RecordDetailPageConfig = z.infer<typeof recordDetailPageConfigSchema>;

export const listPageConfigSchema = z.object({
  ...basePageFields,
  type: z.literal("list"),
  tableId: z.string(),
  viewId: z.string().optional(),
  titleFieldId: z.string(),
  subtitleFieldId: z.string().optional(),
  imageFieldId: z.string().optional(),
  filters: filterNodeSchema.optional(),
});
export type ListPageConfig = z.infer<typeof listPageConfigSchema>;

export const dashboardWidgetSchema = z.object({
  type: z.enum(["number", "bar", "line", "pie"]),
  tableId: z.string(),
  aggregation: z.object({
    fn: z.enum(["count", "sum", "avg", "min", "max"]),
    fieldId: z.string().optional(),
  }),
  groupByFieldId: z.string().optional(),
  filters: filterNodeSchema.optional(),
});
export type DashboardWidget = z.infer<typeof dashboardWidgetSchema>;

export const previewDashboardSchema = z.object({
  widgets: z.array(dashboardWidgetSchema),
});
export type PreviewDashboardDto = z.infer<typeof previewDashboardSchema>;

export const dashboardPageConfigSchema = z.object({
  ...basePageFields,
  type: z.literal("dashboard"),
  widgets: z.array(dashboardWidgetSchema),
});
export type DashboardPageConfig = z.infer<typeof dashboardPageConfigSchema>;

export const formPageConfigSchema = z.object({
  ...basePageFields,
  type: z.literal("form"),
  tableId: z.string(),
  fields: z.array(
    z.object({
      fieldId: z.string(),
      label: z.string(),
      required: z.boolean().default(false),
      helpText: z.string().optional(),
    }),
  ),
  submitText: z.string().default("Submit"),
  successMessage: z.string().default("Thanks! Your response was recorded."),
  redirectUrl: z.string().url().optional(),
});
export type FormPageConfig = z.infer<typeof formPageConfigSchema>;

export const pageConfigSchema = z.discriminatedUnion("type", [
  gridPageConfigSchema,
  recordDetailPageConfigSchema,
  listPageConfigSchema,
  dashboardPageConfigSchema,
  formPageConfigSchema,
]);
export type PageConfig = z.infer<typeof pageConfigSchema>;

export const createInterfaceSchema = z.object({
  baseId: z.string().min(1),
  name: z.string().min(1).max(120),
});
export type CreateInterfaceDto = z.infer<typeof createInterfaceSchema>;

export const createPageSchema = z.object({
  interfaceId: z.string().min(1),
  name: z.string().min(1).max(120),
  config: pageConfigSchema,
});
export type CreatePageDto = z.infer<typeof createPageSchema>;

export const updatePageSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  config: pageConfigSchema.optional(),
  pos: z.number().optional(),
});
export type UpdatePageDto = z.infer<typeof updatePageSchema>;
