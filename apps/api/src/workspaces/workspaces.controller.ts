import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { createWorkspaceSchema, inviteMemberSchema, updateMemberRoleSchema } from "@tratable/shared";
import { CurrentUser, RequestUser } from "../common/decorators/current-user.decorator";
import { RequireRole } from "../common/decorators/require-role.decorator";
import { ResourceParam } from "../common/decorators/resource-param.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { WorkspacesService } from "./workspaces.service";

@Controller("workspaces")
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Post()
  create(@CurrentUser() user: RequestUser, @Body(new ZodValidationPipe(createWorkspaceSchema)) dto: any) {
    return this.workspaces.create(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.workspaces.listForUser(user.id);
  }

  @Get(":workspaceId/members")
  @RequireRole("viewer")
  @ResourceParam("workspace", "workspaceId")
  listMembers(@Param("workspaceId") workspaceId: string) {
    return this.workspaces.listMembers(workspaceId);
  }

  @Post(":workspaceId/members")
  @RequireRole("admin")
  @ResourceParam("workspace", "workspaceId")
  invite(
    @Param("workspaceId") workspaceId: string,
    @Body(new ZodValidationPipe(inviteMemberSchema)) dto: any,
  ) {
    return this.workspaces.inviteMember(workspaceId, dto.email, dto.role);
  }

  @Patch(":workspaceId/members/:userId")
  @RequireRole("admin")
  @ResourceParam("workspace", "workspaceId")
  updateRole(
    @Param("workspaceId") workspaceId: string,
    @Param("userId") userId: string,
    @Body(new ZodValidationPipe(updateMemberRoleSchema)) dto: any,
  ) {
    return this.workspaces.updateMemberRole(workspaceId, userId, dto.role);
  }

  @Delete(":workspaceId/members/:userId")
  @RequireRole("admin")
  @ResourceParam("workspace", "workspaceId")
  remove(@Param("workspaceId") workspaceId: string, @Param("userId") userId: string) {
    return this.workspaces.removeMember(workspaceId, userId);
  }
}
