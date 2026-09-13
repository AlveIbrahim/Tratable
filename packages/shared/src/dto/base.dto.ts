import { z } from "zod";

export const createBaseSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(120),
  icon: z.string().max(8).optional(),
  color: z.string().max(20).optional(),
});
export type CreateBaseDto = z.infer<typeof createBaseSchema>;

export const updateBaseSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  icon: z.string().max(8).optional(),
  color: z.string().max(20).optional(),
});
export type UpdateBaseDto = z.infer<typeof updateBaseSchema>;
