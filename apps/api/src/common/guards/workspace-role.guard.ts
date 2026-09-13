import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { WorkspaceRole } from "@tratable/shared";
import { roleAtLeast, REQUIRE_ROLE_KEY } from "../decorators/require-role.decorator";
import { RESOURCE_PARAM_KEY, ResourceParamMeta } from "../decorators/resource-param.decorator";
import { WorkspaceAccessService } from "../../workspaces/workspace-access.service";

@Injectable()
export class WorkspaceRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: WorkspaceAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRole = this.reflector.getAllAndOverride<WorkspaceRole>(REQUIRE_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRole) return true; // route opted out of resource-scoped authz

    const meta = this.reflector.getAllAndOverride<ResourceParamMeta>(RESOURCE_PARAM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!meta) {
      throw new Error(
        `@RequireRole used without @ResourceParam on ${context.getClass().name}.${context.getHandler().name}`,
      );
    }

    const request = context.switchToHttp().getRequest();
    const source = meta.source === "body" ? request.body : meta.source === "query" ? request.query : request.params;
    const resourceId = source?.[meta.param];
    if (!resourceId) throw new ForbiddenException(`Missing ${meta.param} for authorization check`);

    const role = await this.access.getRole(request.user.id, meta.kind, resourceId);
    if (!role || !roleAtLeast(role, requiredRole)) {
      throw new ForbiddenException("You do not have permission to perform this action");
    }
    request.workspaceRole = role;
    return true;
  }
}
