import { z } from "zod";

export const workspaceRoleSchema = z.enum(["owner", "admin", "editor", "viewer"]);
export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;

export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(120),
});
export type CreateWorkspaceDto = z.infer<typeof createWorkspaceSchema>;

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: workspaceRoleSchema.exclude(["owner"]),
});
export type InviteMemberDto = z.infer<typeof inviteMemberSchema>;

export const updateMemberRoleSchema = z.object({
  role: workspaceRoleSchema.exclude(["owner"]),
});
export type UpdateMemberRoleDto = z.infer<typeof updateMemberRoleSchema>;
