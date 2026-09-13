import { NotFoundException } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { CreateBaseDto, makeId, UpdateBaseDto } from "@tratable/shared";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class BasesService {
  constructor(private readonly db: DatabaseService) {}

  async create(dto: CreateBaseDto) {
    const id = makeId("base");
    await this.db.db
      .insertInto("bases")
      .values({ id, workspace_id: dto.workspaceId, name: dto.name, icon: dto.icon ?? null, color: dto.color ?? null })
      .execute();
    return this.getOrThrow(id);
  }

  async listForWorkspace(workspaceId: string) {
    return this.db.db
      .selectFrom("bases")
      .selectAll()
      .where("workspace_id", "=", workspaceId)
      .where("deleted_at", "is", null)
      .orderBy("created_at", "asc")
      .execute();
  }

  async getOrThrow(id: string) {
    const base = await this.db.db
      .selectFrom("bases")
      .selectAll()
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst();
    if (!base) throw new NotFoundException("Base not found");
    return base;
  }

  async update(id: string, dto: UpdateBaseDto) {
    await this.getOrThrow(id);
    await this.db.db
      .updateTable("bases")
      .set({ ...dto, updated_at: new Date().toISOString() })
      .where("id", "=", id)
      .execute();
    return this.getOrThrow(id);
  }

  async softDelete(id: string) {
    await this.getOrThrow(id);
    await this.db.db
      .updateTable("bases")
      .set({ deleted_at: new Date().toISOString() })
      .where("id", "=", id)
      .execute();
  }
}
