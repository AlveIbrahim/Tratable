import { Injectable, NotFoundException } from "@nestjs/common";
import { CreateViewDto, makeId, UpdateViewDto, viewConfigSchema } from "@tratable/shared";
import { DatabaseService } from "../database/database.service";

const POS_STEP = 65536;
const DEFAULT_CONFIG = viewConfigSchema.parse({});

@Injectable()
export class ViewsService {
  constructor(private readonly db: DatabaseService) {}

  async create(dto: CreateViewDto) {
    const max = await this.db.db
      .selectFrom("views")
      .select(({ fn }) => fn.max("pos").as("maxPos"))
      .where("table_id", "=", dto.tableId)
      .executeTakeFirst();
    const pos = (Number(max?.maxPos) || 0) + POS_STEP;

    const id = makeId("view");
    const config = { ...DEFAULT_CONFIG, ...(dto.config ?? {}) };
    await this.db.db
      .insertInto("views")
      .values({ id, table_id: dto.tableId, name: dto.name, type: dto.type ?? "grid", config: JSON.stringify(config), pos })
      .execute();
    return this.getOrThrow(id);
  }

  async listForTable(tableId: string) {
    return this.db.db.selectFrom("views").selectAll().where("table_id", "=", tableId).orderBy("pos", "asc").execute();
  }

  async getOrThrow(id: string) {
    const view = await this.db.db.selectFrom("views").selectAll().where("id", "=", id).executeTakeFirst();
    if (!view) throw new NotFoundException("View not found");
    return view;
  }

  async update(id: string, dto: UpdateViewDto) {
    const view = await this.getOrThrow(id);
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.pos !== undefined) patch.pos = dto.pos;
    if (dto.config !== undefined) {
      // A key sent as `null` means "clear this" (see viewConfigPatchSchema) —
      // delete it from the merged config rather than storing a literal null,
      // so e.g. "Group by: None" actually removes groupByFieldId instead of
      // leaving a null that every reader would have to special-case.
      const merged: Record<string, unknown> = { ...(view.config as object) };
      for (const [key, value] of Object.entries(dto.config)) {
        if (value === null) delete merged[key];
        else merged[key] = value;
      }
      patch.config = JSON.stringify(merged);
    }
    await this.db.db.updateTable("views").set(patch).where("id", "=", id).execute();
    return this.getOrThrow(id);
  }

  async remove(id: string) {
    await this.getOrThrow(id);
    await this.db.db.deleteFrom("views").where("id", "=", id).execute();
  }
}
