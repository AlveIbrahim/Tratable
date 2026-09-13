import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { sql } from "kysely";
import { ChangeFieldTypeDto, CreateFieldDto, getFieldType, makeId, UpdateFieldDto } from "@tratable/shared";
import { DatabaseService } from "../database/database.service";

const POS_STEP = 65536;

@Injectable()
export class FieldsService {
  constructor(private readonly db: DatabaseService) {}

  async create(dto: CreateFieldDto) {
    const def = getFieldType(dto.type as any);
    const options = { ...def.defaultOptions, ...(dto.options ?? {}) };

    const max = await this.db.db
      .selectFrom("fields")
      .select(({ fn }) => fn.max("pos").as("maxPos"))
      .where("table_id", "=", dto.tableId)
      .where("deleted_at", "is", null)
      .executeTakeFirst();
    const pos = (Number(max?.maxPos) || 0) + POS_STEP;

    const id = makeId("field");
    await this.db.db
      .insertInto("fields")
      .values({ id, table_id: dto.tableId, name: dto.name, type: dto.type, options: JSON.stringify(options), pos })
      .execute();
    return this.getOrThrow(id);
  }

  async listForTable(tableId: string) {
    return this.db.db
      .selectFrom("fields")
      .selectAll()
      .where("table_id", "=", tableId)
      .where("deleted_at", "is", null)
      .orderBy("pos", "asc")
      .execute();
  }

  async getOrThrow(id: string) {
    const field = await this.db.db
      .selectFrom("fields")
      .selectAll()
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst();
    if (!field) throw new NotFoundException("Field not found");
    return field;
  }

  async update(id: string, dto: UpdateFieldDto) {
    const field = await this.getOrThrow(id);
    const patch: Record<string, unknown> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.pos !== undefined) patch.pos = dto.pos;
    if (dto.options !== undefined) {
      const merged = { ...(field.options as Record<string, unknown>), ...dto.options };
      patch.options = JSON.stringify(merged);
    }
    patch.updated_at = new Date().toISOString();
    await this.db.db.updateTable("fields").set(patch).where("id", "=", id).execute();
    return this.getOrThrow(id);
  }

  /**
   * A type change is distinct from a normal update: it may need to reinterpret
   * every row's value for this field. dryRun previews how many rows would
   * fail to convert without writing anything, so the UI can warn before commit.
   */
  async changeType(id: string, dto: ChangeFieldTypeDto) {
    const field = await this.getOrThrow(id);
    const targetDef = getFieldType(dto.newType);
    const newOptions = { ...targetDef.defaultOptions, ...(dto.newOptions ?? {}) };

    const rows = await this.db.db
      .selectFrom("records")
      .select(["id", "data"])
      .where("table_id", "=", field.table_id)
      .where("deleted_at", "is", null)
      .execute();

    let convertible = 0;
    let willBeCleared = 0;
    for (const row of rows) {
      const current = (row.data as Record<string, unknown>)[id];
      if (current === undefined || current === null) continue;
      // Round-trip through CSV representation: format under the old type,
      // then re-parse under the new type. Good enough for the common cases
      // (text<->number<->select) without a combinatorial per-pair matrix.
      const oldDef = getFieldType(field.type as any);
      const asText = oldDef.formatToCsv(current, field.options as any, {});
      const reparsed = targetDef.parseFromCsv(asText, newOptions, {});
      if (reparsed.ok && reparsed.value !== null) convertible++;
      else willBeCleared++;
    }

    if (dto.dryRun) {
      return { convertible, willBeCleared, totalRows: rows.length };
    }

    return this.db.runInTransaction(async () => {
      for (const row of rows) {
        const current = (row.data as Record<string, unknown>)[id];
        if (current === undefined || current === null) continue;
        const oldDef = getFieldType(field.type as any);
        const asText = oldDef.formatToCsv(current, field.options as any, {});
        const reparsed = targetDef.parseFromCsv(asText, newOptions, {});
        const newValue = reparsed.ok ? reparsed.value : null;
        await this.db.db
          .updateTable("records")
          .set({ data: sql`jsonb_set(data, ${sql.lit(`{${id}}`)}, ${JSON.stringify(newValue)}::jsonb)` })
          .where("id", "=", row.id)
          .execute();
      }
      await this.db.db
        .updateTable("fields")
        .set({ type: dto.newType, options: JSON.stringify(newOptions), updated_at: new Date().toISOString() })
        .where("id", "=", id)
        .execute();
      return this.getOrThrow(id);
    });
  }

  async softDelete(id: string) {
    const field = await this.getOrThrow(id);
    const table = await this.db.db
      .selectFrom("tables")
      .select("primary_field_id")
      .where("id", "=", field.table_id)
      .executeTakeFirst();
    if (table?.primary_field_id === id) {
      throw new BadRequestException("Cannot delete a table's primary field");
    }
    await this.db.db.updateTable("fields").set({ deleted_at: new Date().toISOString() }).where("id", "=", id).execute();
    // Orphaned JSONB keys are stripped lazily by a periodic job (Phase 9),
    // not synchronously here — deleting a field on a 100k-row table
    // shouldn't block the request on rewriting every row.
  }
}
