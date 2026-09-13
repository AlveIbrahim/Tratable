import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { WorkspacesController } from "./workspaces.controller";
import { WorkspacesService } from "./workspaces.service";
import { WorkspaceAccessService } from "./workspace-access.service";
import { WorkspaceRoleGuard } from "../common/guards/workspace-role.guard";

@Module({
  controllers: [WorkspacesController],
  providers: [
    WorkspacesService,
    WorkspaceAccessService,
    { provide: APP_GUARD, useClass: WorkspaceRoleGuard },
  ],
  exports: [WorkspaceAccessService],
})
export class WorkspacesModule {}
