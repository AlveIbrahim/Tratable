import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PassThrough, Readable } from "node:stream";
import { stringify, Stringifier } from "csv-stringify";
import { ZipArchive } from "archiver";
import { sql } from "kysely";
import { FilterNode, getFieldType, SortSpec } from "@tratable/shared";
import { DatabaseService } from "../database/database.service";
import { FieldRow, RecordRow } from "../database/schema";
import { compileFilterTree, compileSorts, QueryCompilerError } from "../query/query-compiler";

const BATCH_SIZE = 2000;

interface ResolvedView {
  fields: FieldRow[]; // in export order, already filtered to visible ones
  filters?: FilterNode;
  sorts: SortSpec[];
}

@Injectable()
export class ExportService {
  constructor(private readonly db: DatabaseService) {}

  private async getTableOrThrow(tableId: string) {
    const table = await this.db.db
      .selectFrom("tables")
      .selectAll()
      .where("id", "=", tableId)
      .where("deleted_at", "is", null)
      .executeTakeFirst();
    if (!table) throw new NotFoundException("Table not found");
    return table;
  }

  private async resolveView(tableId: string, viewId: string | undefined): Promise<ResolvedView> {
    const allFields = await this.db.db
      .selectFrom("fields")
      .selectAll()
      .where("table_id", "=", tableId)
      .where("deleted_at", "is", null)
      .orderBy("pos", "asc")
      .execute();

    if (!viewId) {
      return { fields: allFields, sorts: [] };
    }

    const view = await this.db.db
      .selectFrom("views")
      .selectAll()
      .where("id", "=", viewId)
      .where("table_id", "=", tableId)
      .executeTakeFirst();
    if (!view) throw new NotFoundException("View not found for this table");

    const config = view.config as {
      fieldOrder?: string[];
      hiddenFieldIds?: string[];
      filters?: FilterNode;
      sorts?: SortSpec[];
    };

    const hidden = new Set(config.hiddenFieldIds ?? []);
    const visible = allFields.filter((f) => !hidden.has(f.id));
    const order = config.fieldOrder ?? [];
    const ordered = [...visible].sort((a, b) => {
      const ai = order.indexOf(a.id);
      const bi = order.indexOf(b.id);
      if (ai === -1 && bi === -1) return a.pos - b.pos;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

    return { fields: ordered, filters: config.filters, sorts: config.sorts ?? [] };
  }

  /** Streams a single table as CSV honoring an optional view's filters,
   * sort, field order, and hidden fields. Never materializes the full
   * result set — records are fetched in keyset-paginated batches and
   * written to the stream as they arrive, so memory stays flat regardless
   * of table size. */
  async streamTableCsv(tableId: string, viewId: string | undefined): Promise<{ stream: Readable; tableName: string }> {
    const table = await this.getTableOrThrow(tableId);
    let resolved: ResolvedView;
    try {
      resolved = await this.resolveView(tableId, viewId);
    } catch (e) {
      if (e instanceof QueryCompilerError) throw new BadRequestException(e.message);
      throw e;
    }

    const output = new PassThrough();
    const csvStream = stringify({ header: true, columns: resolved.fields.map((f) => ({ key: f.id, header: f.name })) });
    csvStream.pipe(output);

    this.pumpRows(tableId, resolved, csvStream).catch((err) => {
      csvStream.destroy(err);
    });

    return { stream: output, tableName: table.name };
  }

  private async pumpRows(tableId: string, resolved: ResolvedView, csvStream: Stringifier) {
    // Pre-resolve every link field's target-table primary-field labels up
    // front, once per export — cheap relative to a table's own row count
    // and far simpler than resolving per-batch.
    const linkLabelResolvers = await this.buildLinkLabelResolvers(resolved.fields);

    let cursor: { sortValue: unknown; id: string } | undefined;
    const sorts: SortSpec[] = resolved.sorts.length ? resolved.sorts : [{ fieldId: "__pos__", direction: "asc" }];
    const primarySort = sorts[0];
    const usingPos = primarySort.fieldId === "__pos__";

    // eslint-disable-next-line no-constant-condition
    while (true) {
      let query = this.db.db
        .selectFrom("records")
        .selectAll()
        .where("table_id", "=", tableId)
        .where("deleted_at", "is", null);

      if (resolved.filters) {
        const compiled = compileFilterTree(resolved.filters, resolved.fields);
        query = query.where(() => compiled);
      }

      const sortExprSql = usingPos
        ? sql.raw("pos")
        : compileSorts([primarySort], resolved.fields)[0].expr;

      if (cursor) {
        const cmp = primarySort.direction === "asc" ? sql`>` : sql`<`;
        query = query.where(() => sql`(${sortExprSql}, id) ${cmp} (${cursor!.sortValue}, ${cursor!.id})`);
      }

      const rows = await query
        .orderBy(sortExprSql as any, primarySort.direction)
        .orderBy("id", primarySort.direction)
        .limit(BATCH_SIZE)
        .execute();

      if (rows.length === 0) break;

      for (const row of rows) {
        const record = row as RecordRow;
        const line: Record<string, string> = {};
        for (const field of resolved.fields) {
          const def = getFieldType(field.type as any);
          const value = (record.data as Record<string, unknown>)[field.id] ?? null;
          const ctx =
            field.type === "linkToRecord"
              ? { resolveLinkLabels: linkLabelResolvers.get(field.id) }
              : {};
          line[field.id] = def.formatToCsv(value as any, field.options as any, ctx);
        }
        if (!csvStream.write(line)) {
          await new Promise((resolve) => csvStream.once("drain", resolve));
        }
      }

      const last = rows[rows.length - 1];
      cursor = {
        sortValue: usingPos ? last.pos : (last.data as Record<string, unknown>)[primarySort.fieldId] ?? null,
        id: last.id,
      };

      if (rows.length < BATCH_SIZE) break;
    }

    csvStream.end();
  }

  private async buildLinkLabelResolvers(fields: FieldRow[]): Promise<Map<string, (ids: string[]) => string[]>> {
    const resolvers = new Map<string, (ids: string[]) => string[]>();
    for (const field of fields) {
      if (field.type !== "linkToRecord") continue;
      const linkedTableId = (field.options as any)?.linkedTableId;
      if (!linkedTableId) continue;

      const linkedTable = await this.db.db
        .selectFrom("tables")
        .select("primary_field_id")
        .where("id", "=", linkedTableId)
        .executeTakeFirst();
      if (!linkedTable?.primary_field_id) continue;
      const primaryFieldId = linkedTable.primary_field_id;

      const linkedRecords = await this.db.db
        .selectFrom("records")
        .select(["id", "data"])
        .where("table_id", "=", linkedTableId)
        .where("deleted_at", "is", null)
        .execute();

      const labelById = new Map<string, string>();
      for (const r of linkedRecords) {
        const label = (r.data as Record<string, unknown>)[primaryFieldId];
        labelById.set(r.id, label != null ? String(label) : "");
      }

      resolvers.set(field.id, (ids: string[]) => ids.map((id) => labelById.get(id) ?? id));
    }
    return resolvers;
  }

  /** Streams a zip containing one CSV per table in the base. */
  async streamBaseZip(baseId: string): Promise<{ stream: Readable; baseName: string }> {
    const base = await this.db.db
      .selectFrom("bases")
      .selectAll()
      .where("id", "=", baseId)
      .where("deleted_at", "is", null)
      .executeTakeFirst();
    if (!base) throw new NotFoundException("Base not found");

    const tables = await this.db.db
      .selectFrom("tables")
      .selectAll()
      .where("base_id", "=", baseId)
      .where("deleted_at", "is", null)
      .orderBy("pos", "asc")
      .execute();

    const archive = new ZipArchive({ zlib: { level: 6 } });
    // Run sequentially, not in parallel — each table export already streams
    // in bounded batches, and parallelizing across tables would multiply
    // peak memory/connection usage for no real speed benefit on a base zip
    // that's downloaded once, not served at request-rate.
    (async () => {
      try {
        for (const table of tables) {
          const { stream } = await this.streamTableCsv(table.id, undefined);
          const safeName = table.name.replace(/[/\\?%*:|"<>]/g, "_");
          archive.append(stream, { name: `${safeName}.csv` });
          await new Promise((resolve, reject) => {
            stream.on("end", resolve);
            stream.on("error", reject);
          });
        }
        await archive.finalize();
      } catch (err) {
        archive.destroy(err as Error);
      }
    })();

    return { stream: archive, baseName: base.name };
  }
}
