import { Injectable, NotFoundException } from "@nestjs/common";
import { CreateTableDto, makeId, UpdateTableDto } from "@tratable/shared";
import { DatabaseService } from "../database/database.service";

const POS_STEP = 65536;

@Injectable()
export class TablesService {
  constructor(private readonly db: DatabaseService) {}

  async create(dto: CreateTableDto) {
    const id = makeId("table");
    const max = await this.db.db
      .selectFrom("tables")
      .select(({ fn }) => fn.max("pos").as("maxPos"))
      .where("base_id", "=", dto.baseId)
      .where("deleted_at", "is", null)
      .executeTakeFirst();
    const pos = (Number(max?.maxPos) || 0) + POS_STEP;

    await this.db.db
      .insertInto("tables")
      .values({ id, base_id: dto.baseId, name: dto.name, description: dto.description ?? null, pos })
      .execute();

    // Every table starts with a default grid view and a primary text field,
    // matching Airtable's own "new table" behavior.
    return this.db.runInTransaction(async () => {
      const fieldId = makeId("field");
      await this.db.db
        .insertInto("fields")
        .values({ id: fieldId, table_id: id, name: "Name", type: "singleLineText", pos: POS_STEP })
        .execute();
      await this.db.db.updateTable("tables").set({ primary_field_id: fieldId }).where("id", "=", id).execute();

      await this.db.db
        .insertInto("views")
        .values({ id: makeId("view"), table_id: id, name: "Grid view", type: "grid", pos: POS_STEP })
        .execute();

      return this.getOrThrow(id);
    });
  }

  async listForBase(baseId: string) {
    return this.db.db
      .selectFrom("tables")
      .selectAll()
      .where("base_id", "=", baseId)
      .where("deleted_at", "is", null)
      .orderBy("pos", "asc")
      .execute();
  }

  async getOrThrow(id: string) {
    const table = await this.db.db
      .selectFrom("tables")
      .selectAll()
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst();
    if (!table) throw new NotFoundException("Table not found");
    return table;
  }

  async update(id: string, dto: UpdateTableDto) {
    await this.getOrThrow(id);
    await this.db.db
      .updateTable("tables")
      .set({ ...dto, updated_at: new Date().toISOString() })
      .where("id", "=", id)
      .execute();
    return this.getOrThrow(id);
  }

  async softDelete(id: string) {
    await this.getOrThrow(id);
    await this.db.db.updateTable("tables").set({ deleted_at: new Date().toISOString() }).where("id", "=", id).execute();
  }
}
