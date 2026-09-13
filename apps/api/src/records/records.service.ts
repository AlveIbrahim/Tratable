import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { sql } from "kysely";
import {
  BulkCreateRecordsDto,
  BulkUpdateRecordsDto,
  CreateRecordDto,
  FilterNode,
  getFieldType,
  makeId,
  SortSpec,
  UpdateRecordDto,
} from "@tratable/shared";
import { DatabaseService } from "../database/database.service";
import { decodeCursor, encodeCursor } from "../common/pagination";
import { compileFilterTree, compileKeysetCondition, compileSortExpr, orderByModifier, QueryCompilerError } from "../query/query-compiler";
import { FieldRow } from "../database/schema";

const POS_STEP = 65536;
const MIN_POS_GAP = 1e-9;

@Injectable()
export class RecordsService {
  constructor(private readonly db: DatabaseService) {}

  private async getFields(tableId: string): Promise<FieldRow[]> {
    return this.db.db
      .selectFrom("fields")
      .selectAll()
      .where("table_id", "=", tableId)
      .where("deleted_at", "is", null)
      .execute();
  }

  /** Validates a record payload against every field's registered validator,
   * dropping unknown keys and rejecting the write on the first bad value. */
  private validate(fields: FieldRow[], data: Record<string, unknown>): Record<string, unknown> {
    const clean: Record<string, unknown> = {};
    for (const field of fields) {
      if (!(field.id in data)) continue;
      const def = getFieldType(field.type as any);
      const result = def.validate(data[field.id], field.options as any);
      if (!result.ok) {
        throw new BadRequestException(`Field "${field.name}": ${result.error}`);
      }
      if (result.value !== null && result.value !== undefined) clean[field.id] = result.value;
    }
    return clean;
  }

  async create(tableId: string, userId: string, dto: CreateRecordDto) {
    const fields = await this.getFields(tableId);
    const clean = this.validate(fields, dto.data);

    const max = await this.db.db
      .selectFrom("records")
      .select(({ fn }) => fn.max("pos").as("maxPos"))
      .where("table_id", "=", tableId)
      .where("deleted_at", "is", null)
      .executeTakeFirst();
    const pos = (Number(max?.maxPos) || 0) + POS_STEP;

    const id = makeId("record");
    await this.db.db
      .insertInto("records")
      .values({ id, table_id: tableId, data: JSON.stringify(clean), pos, created_by: userId, updated_by: userId })
      .execute();
    return this.getOrThrow(id);
  }

  async bulkCreate(tableId: string, userId: string, dto: BulkCreateRecordsDto) {
    const fields = await this.getFields(tableId);
    return this.db.runInTransaction(async () => {
      const max = await this.db.db
        .selectFrom("records")
        .select(({ fn }) => fn.max("pos").as("maxPos"))
        .where("table_id", "=", tableId)
        .where("deleted_at", "is", null)
        .executeTakeFirst();
      let pos = Number(max?.maxPos) || 0;

      const ids: string[] = [];
      for (const rec of dto.records) {
        const clean = this.validate(fields, rec.data);
        pos += POS_STEP;
        const id = makeId("record");
        ids.push(id);
        await this.db.db
          .insertInto("records")
          .values({ id, table_id: tableId, data: JSON.stringify(clean), pos, created_by: userId, updated_by: userId })
          .execute();
      }
      return ids;
    });
  }

  async getOrThrow(id: string) {
    const record = await this.db.db
      .selectFrom("records")
      .selectAll()
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst();
    if (!record) throw new NotFoundException("Record not found");
    return record;
  }

  async update(id: string, userId: string, dto: UpdateRecordDto) {
    const record = await this.getOrThrow(id);
    const fields = await this.getFields(record.table_id);
    const clean = this.validate(fields, dto.data);
    const merged = { ...(record.data as Record<string, unknown>), ...clean };
    await this.db.db
      .updateTable("records")
      .set({ data: JSON.stringify(merged), updated_by: userId, updated_at: new Date().toISOString() })
      .where("id", "=", id)
      .execute();
    return this.getOrThrow(id);
  }

  /** tableId is the table the caller's role was checked against (see the
   * controller's @ResourceParam) — every record id in the batch must belong
   * to it, or a caller with editor rights on table A could smuggle writes
   * into table B just by naming its record ids. */
  async bulkUpdate(tableId: string, userId: string, dto: BulkUpdateRecordsDto) {
    return this.db.runInTransaction(async () => {
      const results: Awaited<ReturnType<typeof this.update>>[] = [];
      for (const item of dto.records) {
        const existing = await this.getOrThrow(item.id);
        if (existing.table_id !== tableId) {
          throw new BadRequestException(`Record ${item.id} does not belong to table ${tableId}`);
        }
        results.push(await this.update(item.id, userId, { data: item.data }));
      }
      return results;
    });
  }

  async softDelete(id: string) {
    await this.getOrThrow(id);
    await this.db.db.updateTable("records").set({ deleted_at: new Date().toISOString() }).where("id", "=", id).execute();
  }

  /**
   * Keyset-paginated, filtered, multi-sorted listing. Never uses OFFSET —
   * the cursor carries one value per active sort column plus `id`, opaque
   * base64 to the caller. Supports an arbitrary number of sort columns
   * (each with its own direction) correctly across page boundaries, not
   * just the first one — see compileKeysetCondition's doc comment for why
   * that distinction matters (it's also what makes "group by field X"
   * work correctly: grouping is implemented by prepending the group field
   * as sort column zero, which only paginates correctly if every sort
   * column after it is honored too).
   */
  async list(
    tableId: string,
    opts: { filters?: FilterNode; sorts?: SortSpec[]; cursor?: string; limit: number },
  ) {
    const fields = await this.getFields(tableId);
    const sorts: SortSpec[] = opts.sorts?.length ? opts.sorts : [{ fieldId: "__pos__", direction: "asc" }];

    let query = this.db.db
      .selectFrom("records")
      .selectAll()
      .where("table_id", "=", tableId)
      .where("deleted_at", "is", null);

    // Both compiler calls validate every fieldId/op against this table's own
    // field list and throw QueryCompilerError on anything unknown or
    // unsupported — a client-supplied filter/sort is untrusted input, so
    // this must surface as 400 Bad Request, never a bare 500.
    let sortColumns: { expr: ReturnType<typeof compileSortExpr>; direction: "asc" | "desc"; fieldId: string }[];
    try {
      if (opts.filters) {
        const compiled = compileFilterTree(opts.filters, fields);
        query = query.where(() => compiled);
      }
      sortColumns = sorts.map((s) => ({
        expr: s.fieldId === "__pos__" ? sql.raw("pos") : compileSortExpr(this.fieldById(fields, s.fieldId)),
        direction: s.direction,
        fieldId: s.fieldId,
      }));
    } catch (e) {
      if (e instanceof QueryCompilerError) throw new BadRequestException(e.message);
      throw e;
    }

    // `id` is always the final, implicit tiebreak column — ascending,
    // independent of the other columns' directions (see
    // compileKeysetCondition's doc comment for why that's still correct).
    const idCol = { expr: sql.raw("id") as ReturnType<typeof compileSortExpr>, direction: "asc" as const, fieldId: "id" };
    const allColumns = [...sortColumns, idCol];

    if (opts.cursor) {
      const cursor = decodeCursor(opts.cursor);
      if (cursor.sortValues.length !== sortColumns.length) {
        throw new BadRequestException("Cursor does not match the current sort — reload and try again");
      }
      const condition = compileKeysetCondition(allColumns, [...cursor.sortValues, cursor.id]);
      query = query.where(() => condition);
    }

    for (const col of allColumns) {
      query = query.orderBy(col.expr as any, orderByModifier(col.direction));
    }
    query = query.limit(opts.limit + 1);

    const rows = await query.execute();
    const hasMore = rows.length > opts.limit;
    const page = hasMore ? rows.slice(0, opts.limit) : rows;

    let nextCursor: string | null = null;
    if (hasMore) {
      const last = page[page.length - 1];
      const sortValues = sortColumns.map((col) =>
        col.fieldId === "__pos__" ? last.pos : ((last.data as Record<string, unknown>)[col.fieldId] ?? null),
      );
      nextCursor = encodeCursor({ sortValues, id: last.id });
    }

    return { records: page, nextCursor };
  }

  private fieldById(fields: FieldRow[], fieldId: string): FieldRow {
    const field = fields.find((f) => f.id === fieldId);
    if (!field) throw new QueryCompilerError(`Unknown field "${fieldId}" for this table`);
    return field;
  }

  /** Move a record to sit between two neighbors (either may be omitted for
   * "move to start/end"). Rebalances the whole table when the gap collapses. */
  async reorder(id: string, tableId: string, beforePos: number | null, afterPos: number | null) {
    let newPos: number;
    if (beforePos === null && afterPos === null) {
      newPos = POS_STEP;
    } else if (beforePos === null) {
      newPos = afterPos! - POS_STEP;
    } else if (afterPos === null) {
      newPos = beforePos + POS_STEP;
    } else {
      newPos = (beforePos + afterPos) / 2;
      if (Math.abs(afterPos - beforePos) < MIN_POS_GAP) {
        await this.rebalance(tableId);
        return this.reorder(id, tableId, null, null); // caller should re-fetch neighbor pos and retry after rebalance
      }
    }
    await this.db.db.updateTable("records").set({ pos: newPos }).where("id", "=", id).execute();
  }

  private async rebalance(tableId: string) {
    const rows = await this.db.db
      .selectFrom("records")
      .select(["id"])
      .where("table_id", "=", tableId)
      .where("deleted_at", "is", null)
      .orderBy("pos", "asc")
      .execute();
    await this.db.runInTransaction(async () => {
      for (let i = 0; i < rows.length; i++) {
        await this.db.db
          .updateTable("records")
          .set({ pos: (i + 1) * POS_STEP })
          .where("id", "=", rows[i].id)
          .execute();
      }
    });
  }
}
