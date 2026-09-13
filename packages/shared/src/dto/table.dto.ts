import { z } from "zod";

export const createTableSchema = z.object({
  baseId: z.string().min(1),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
});
export type CreateTableDto = z.infer<typeof createTableSchema>;

export const updateTableSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).optional(),
  pos: z.number().optional(),
  primaryFieldId: z.string().optional(),
});
export type UpdateTableDto = z.infer<typeof updateTableSchema>;
