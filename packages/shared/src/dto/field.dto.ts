import { z } from "zod";

export const fieldTypeSchema = z.enum([
  "singleLineText", "longText", "number", "checkbox", "singleSelect",
  "multiSelect", "date", "dateTime", "email", "url", "phone", "attachment",
  "linkToRecord", "autoNumber", "createdTime", "lastModifiedTime",
]);

export const createFieldSchema = z.object({
  tableId: z.string().min(1),
  name: z.string().min(1).max(120),
  type: fieldTypeSchema,
  options: z.record(z.string(), z.unknown()).optional(),
});
export type CreateFieldDto = z.infer<typeof createFieldSchema>;

export const updateFieldSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  options: z.record(z.string(), z.unknown()).optional(),
  pos: z.number().optional(),
});
export type UpdateFieldDto = z.infer<typeof updateFieldSchema>;

/** Explicit type-change request; distinct from updateField because it may
 * require a data-conversion pass and a dry-run preview (see fields module). */
export const changeFieldTypeSchema = z.object({
  newType: fieldTypeSchema,
  newOptions: z.record(z.string(), z.unknown()).optional(),
  dryRun: z.boolean().default(false),
});
export type ChangeFieldTypeDto = z.infer<typeof changeFieldTypeSchema>;
