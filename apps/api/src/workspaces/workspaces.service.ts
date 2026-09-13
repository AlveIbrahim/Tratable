import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { CreateWorkspaceDto, makeId, WorkspaceRole } from "@tratable/shared";
import { DatabaseService } from "../database/database.service";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

@Injectable()
export class WorkspacesService {
  constructor(private readonly db: DatabaseService) {}

  async create(userId: string, dto: CreateWorkspaceDto) {
    return this.db.runInTransaction(async () => {
      const id = makeId("workspace");
      const baseSlug = slugify(dto.name) || "workspace";
      let slug = baseSlug;
      let suffix = 1;
      while (
        await this.db.db.selectFrom("workspaces").select("id").where("slug", "=", slug).executeTakeFirst()
      ) {
        slug = `${baseSlug}-${++suffix}`;
      }

      await this.db.db.insertInto("workspaces").values({ id, name: dto.name, slug, owner_id: userId }).execute();
      await this.db.db
        .insertInto("workspace_members")
        .values({ workspace_id: id, user_id: userId, role: "owner" })
        .execute();

      return { id, name: dto.name, slug };
    });
  }

  async listForUser(userId: string) {
    return this.db.db
      .selectFrom("workspaces")
      .innerJoin("workspace_members", "workspace_members.workspace_id", "workspaces.id")
      .select(["workspaces.id", "workspaces.name", "workspaces.slug", "workspace_members.role"])
      .where("workspace_members.user_id", "=", userId)
      .orderBy("workspaces.created_at", "asc")
      .execute();
  }

  async inviteMember(workspaceId: string, email: string, role: Exclude<WorkspaceRole, "owner">) {
    const user = await this.db.db.selectFrom("users").select("id").where("email", "=", email).executeTakeFirst();
    if (!user) throw new NotFoundException("No user found with that email — they must register first");

    const existing = await this.db.db
      .selectFrom("workspace_members")
      .select("user_id")
      .where("workspace_id", "=", workspaceId)
      .where("user_id", "=", user.id)
      .executeTakeFirst();
    if (existing) throw new ForbiddenException("User is already a member of this workspace");

    await this.db.db
      .insertInto("workspace_members")
      .values({ workspace_id: workspaceId, user_id: user.id, role })
      .execute();
    return { userId: user.id, role };
  }

  async listMembers(workspaceId: string) {
    return this.db.db
      .selectFrom("workspace_members")
      .innerJoin("users", "users.id", "workspace_members.user_id")
      .select(["users.id", "users.email", "users.name", "workspace_members.role"])
      .where("workspace_members.workspace_id", "=", workspaceId)
      .execute();
  }

  async updateMemberRole(workspaceId: string, targetUserId: string, role: Exclude<WorkspaceRole, "owner">) {
    const member = await this.db.db
      .selectFrom("workspace_members")
      .selectAll()
      .where("workspace_id", "=", workspaceId)
      .where("user_id", "=", targetUserId)
      .executeTakeFirst();
    if (!member) throw new NotFoundException("Member not found");
    if (member.role === "owner") throw new ForbiddenException("Cannot change the owner's role");

    await this.db.db
      .updateTable("workspace_members")
      .set({ role })
      .where("workspace_id", "=", workspaceId)
      .where("user_id", "=", targetUserId)
      .execute();
    return { userId: targetUserId, role };
  }

  async removeMember(workspaceId: string, targetUserId: string) {
    const member = await this.db.db
      .selectFrom("workspace_members")
      .selectAll()
      .where("workspace_id", "=", workspaceId)
      .where("user_id", "=", targetUserId)
      .executeTakeFirst();
    if (!member) throw new NotFoundException("Member not found");
    if (member.role === "owner") throw new ForbiddenException("Cannot remove the workspace owner");

    await this.db.db
      .deleteFrom("workspace_members")
      .where("workspace_id", "=", workspaceId)
      .where("user_id", "=", targetUserId)
      .execute();
  }
}
