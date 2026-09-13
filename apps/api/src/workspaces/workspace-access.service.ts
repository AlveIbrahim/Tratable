import { Injectable } from "@nestjs/common";
import { sql } from "kysely";
import { WorkspaceRole } from "@tratable/shared";
import { DatabaseService } from "../database/database.service";

export type ResourceKind = "workspace" | "base" | "table" | "field" | "view" | "record" | "interface" | "page" | "importJob";

/**
 * Resolves "does user X have role >= Y on the workspace that owns resource Z"
 * in one query per resource kind, regardless of how many hops away from the
 * workspace the resource sits (a field is table -> base -> workspace, three
 * joins deep). Walking that chain with separate round trips on every record
 * write is the single easiest way to make this API slow — see docs/PLAN.md.
 */
@Injectable()
export class WorkspaceAccessService {
  constructor(private readonly db: DatabaseService) {}

  async getRole(userId: string, kind: ResourceKind, resourceId: string): Promise<WorkspaceRole | null> {
    const row = await this.roleQuery(userId, kind, resourceId);
    return (row?.role as WorkspaceRole) ?? null;
  }

  private async roleQuery(userId: string, kind: ResourceKind, resourceId: string) {
    const raw = this.db.db;
    switch (kind) {
      case "workspace":
        return raw
          .selectFrom("workspace_members")
          .select("role")
          .where("user_id", "=", userId)
          .where("workspace_id", "=", resourceId)
          .executeTakeFirst();

      case "base":
        return raw
          .selectFrom("workspace_members")
          .innerJoin("bases", "bases.workspace_id", "workspace_members.workspace_id")
          .select("workspace_members.role as role")
          .where("workspace_members.user_id", "=", userId)
          .where("bases.id", "=", resourceId)
          .executeTakeFirst();

      case "table":
        return raw
          .selectFrom("workspace_members")
          .innerJoin("bases", "bases.workspace_id", "workspace_members.workspace_id")
          .innerJoin("tables", "tables.base_id", "bases.id")
          .select("workspace_members.role as role")
          .where("workspace_members.user_id", "=", userId)
          .where("tables.id", "=", resourceId)
          .executeTakeFirst();

      case "field":
        return raw
          .selectFrom("workspace_members")
          .innerJoin("bases", "bases.workspace_id", "workspace_members.workspace_id")
          .innerJoin("tables", "tables.base_id", "bases.id")
          .innerJoin("fields", "fields.table_id", "tables.id")
          .select("workspace_members.role as role")
          .where("workspace_members.user_id", "=", userId)
          .where("fields.id", "=", resourceId)
          .executeTakeFirst();

      case "view":
        return raw
          .selectFrom("workspace_members")
          .innerJoin("bases", "bases.workspace_id", "workspace_members.workspace_id")
          .innerJoin("tables", "tables.base_id", "bases.id")
          .innerJoin("views", "views.table_id", "tables.id")
          .select("workspace_members.role as role")
          .where("workspace_members.user_id", "=", userId)
          .where("views.id", "=", resourceId)
          .executeTakeFirst();

      case "record":
        return raw
          .selectFrom("workspace_members")
          .innerJoin("bases", "bases.workspace_id", "workspace_members.workspace_id")
          .innerJoin("tables", "tables.base_id", "bases.id")
          .innerJoin("records", "records.table_id", "tables.id")
          .select("workspace_members.role as role")
          .where("workspace_members.user_id", "=", userId)
          .where("records.id", "=", resourceId)
          .executeTakeFirst();

      case "interface":
        return raw
          .selectFrom("workspace_members")
          .innerJoin("bases", "bases.workspace_id", "workspace_members.workspace_id")
          .innerJoin("interfaces", "interfaces.base_id", "bases.id")
          .select("workspace_members.role as role")
          .where("workspace_members.user_id", "=", userId)
          .where("interfaces.id", "=", resourceId)
          .executeTakeFirst();

      case "page":
        return raw
          .selectFrom("workspace_members")
          .innerJoin("bases", "bases.workspace_id", "workspace_members.workspace_id")
          .innerJoin("interfaces", "interfaces.base_id", "bases.id")
          .innerJoin("interface_pages", "interface_pages.interface_id", "interfaces.id")
          .select("workspace_members.role as role")
          .where("workspace_members.user_id", "=", userId)
          .where("interface_pages.id", "=", resourceId)
          .executeTakeFirst();

      case "importJob":
        return raw
          .selectFrom("workspace_members")
          .innerJoin("bases", "bases.workspace_id", "workspace_members.workspace_id")
          .innerJoin("import_jobs", "import_jobs.base_id", "bases.id")
          .select("workspace_members.role as role")
          .where("workspace_members.user_id", "=", userId)
          .where("import_jobs.id", "=", resourceId)
          .executeTakeFirst();

      default:
        return sql<never>`select 1 where false`.execute(raw).then(() => undefined);
    }
  }
}
