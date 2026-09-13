import { SetMetadata } from "@nestjs/common";
import { ResourceKind } from "../../workspaces/workspace-access.service";

export const RESOURCE_PARAM_KEY = "resourceParam";

export interface ResourceParamMeta {
  kind: ResourceKind;
  /** Route param name (e.g. "baseId", "tableId") whose value is the resource id.
   * Also checked in body, for creation routes that pass e.g. baseId in the body. */
  param: string;
  source?: "params" | "body" | "query";
}

/** Tells WorkspaceRoleGuard how to find the resource id this route touches,
 * and what kind of resource it is, so it can resolve the owning workspace. */
export const ResourceParam = (kind: ResourceKind, param: string, source: "params" | "body" | "query" = "params") =>
  SetMetadata(RESOURCE_PARAM_KEY, { kind, param, source } satisfies ResourceParamMeta);
