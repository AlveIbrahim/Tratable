import { SetMetadata } from "@nestjs/common";
import { WorkspaceRole } from "@tratable/shared";

export const REQUIRE_ROLE_KEY = "requireRole";
const ROLE_RANK: Record<WorkspaceRole, number> = { viewer: 0, editor: 1, admin: 2, owner: 3 };

export function roleAtLeast(actual: WorkspaceRole, required: WorkspaceRole): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

/** Minimum workspace role required to reach this route. Enforced by
 * WorkspaceRoleGuard, which resolves the route's resource (base/table/record/
 * etc id) to a workspace membership. */
export const RequireRole = (role: WorkspaceRole) => SetMetadata(REQUIRE_ROLE_KEY, role);
