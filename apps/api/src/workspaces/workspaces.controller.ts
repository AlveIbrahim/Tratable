import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { createWorkspaceSchema, inviteMemberSchema, updateMemberRoleSchema } from "@tratable/shared";
import { CurrentUser, RequestUser } from "../common/decorators/current-user.decorator";
import { RequireRole } from "../common/decorators/require-role.decorator";
import { ResourceParam } from "../common/decorators/resource-param.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { WorkspacesService } from "./workspaces.service";

@ApiTags("workspaces")
@ApiBearerAuth("access-token")
@Controller("workspaces")
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Post()
  @ApiOperation({ summary: "Create a workspace (caller becomes its owner)" })
  @ApiBody({ schema: { type: "object", required: ["name"], properties: { name: { type: "string" } } } })
  create(@CurrentUser() user: RequestUser, @Body(new ZodValidationPipe(createWorkspaceSchema)) dto: any) {
    return this.workspaces.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: "List workspaces the caller belongs to, with their role in each" })
  list(@CurrentUser() user: RequestUser) {
    return this.workspaces.listForUser(user.id);
  }

  @Get(":workspaceId/members")
  @RequireRole("viewer")
  @ResourceParam("workspace", "workspaceId")
  @ApiOperation({ summary: "List a workspace's members" })
  @ApiParam({ name: "workspaceId" })
  listMembers(@Param("workspaceId") workspaceId: string) {
    return this.workspaces.listMembers(workspaceId);
  }

  @Post(":workspaceId/members")
  @RequireRole("admin")
  @ResourceParam("workspace", "workspaceId")
  @ApiOperation({ summary: "Invite an existing user (by email) to the workspace with a role" })
  @ApiParam({ name: "workspaceId" })
  @ApiBody({
    schema: {
      type: "object",
      required: ["email", "role"],
      properties: {
        email: { type: "string", format: "email" },
        role: { type: "string", enum: ["admin", "editor", "viewer"] },
      },
    },
  })
  invite(
    @Param("workspaceId") workspaceId: string,
    @Body(new ZodValidationPipe(inviteMemberSchema)) dto: any,
  ) {
    return this.workspaces.inviteMember(workspaceId, dto.email, dto.role);
  }

  @Patch(":workspaceId/members/:userId")
  @RequireRole("admin")
  @ResourceParam("workspace", "workspaceId")
  @ApiOperation({ summary: "Change a member's role" })
  @ApiParam({ name: "workspaceId" })
  @ApiParam({ name: "userId" })
  @ApiBody({
    schema: {
      type: "object",
      required: ["role"],
      properties: { role: { type: "string", enum: ["admin", "editor", "viewer"] } },
    },
  })
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
  @ApiOperation({ summary: "Remove a member from the workspace" })
  @ApiParam({ name: "workspaceId" })
  @ApiParam({ name: "userId" })
  remove(@Param("workspaceId") workspaceId: string, @Param("userId") userId: string) {
    return this.workspaces.removeMember(workspaceId, userId);
  }
}
