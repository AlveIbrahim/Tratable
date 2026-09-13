import { BadRequestException, Injectable } from "@nestjs/common";
import { sql } from "kysely";
import { DashboardWidget } from "@tratable/shared";
import { DatabaseService } from "../database/database.service";
import { FieldRow } from "../database/schema";
import { FieldsService } from "../fields/fields.service";
import { compileFilterTree, compileSortExpr, QueryCompilerError } from "./query-compiler";

/**
 * Computes one dashboard widget's aggregate value (or grouped values) via
 * the existing query compiler — shared by the public route
 * (PublicService.getDashboard, computed against a *published* config) and
 * the authenticated builder (PagesController's dashboard-preview, computed
 * against the *unsaved* config currently being edited) so a widget behaves
 * identically in preview and once it's live. Callers own their own
 * authorization: this service only knows how to turn a widget definition
 * into numbers, not who's allowed to ask for them.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly db: DatabaseService,
    private readonly fields: FieldsService,
  ) {}

  async computeWidget(widget: DashboardWidget) {
    const fields = await this.fields.listForTable(widget.tableId);
    try {
      const where = widget.filters ? compileFilterTree(widget.filters, fields) : sql`TRUE`;
      const aggExpr = this.aggregateExpr(widget.aggregation, fields);

      if (widget.groupByFieldId) {
        const groupField = this.fieldById(fields, widget.groupByFieldId);
        const groupExpr = compileSortExpr(groupField);
        const rows = await sql<{ bucket: unknown; value: number }>`
          SELECT ${groupExpr} AS bucket, ${aggExpr} AS value
          FROM records
          WHERE table_id = ${widget.tableId} AND deleted_at IS NULL AND (${where})
          GROUP BY ${groupExpr}
          ORDER BY value DESC
          LIMIT 50
        `.execute(this.db.db as any);
        // A bucket is a raw stored value (a singleSelect choice id, a JSONB
        // boolean, ...) — resolve it to what a chart should actually label
        // its slice with, e.g. a choice id to its choice name, without
        // exposing the rest of that field's (or any record's) data.
        const groups = rows.rows.map((r) => ({ ...r, label: this.groupBucketLabel(groupField, r.bucket) }));
        return { ...widget, groups };
      }

      const row = await sql<{ value: number }>`
        SELECT ${aggExpr} AS value
        FROM records
        WHERE table_id = ${widget.tableId} AND deleted_at IS NULL AND (${where})
      `.execute(this.db.db as any);
      return { ...widget, value: row.rows[0]?.value ?? 0 };
    } catch (e) {
      if (e instanceof QueryCompilerError) throw new BadRequestException(e.message);
      throw e;
    }
  }

  private fieldById(fields: FieldRow[], fieldId: string): FieldRow {
    const field = fields.find((f) => f.id === fieldId);
    if (!field) throw new QueryCompilerError(`Unknown field "${fieldId}" for this table`);
    return field;
  }

  private groupBucketLabel(field: FieldRow, bucket: unknown): string {
    if (bucket === null || bucket === undefined) return "(empty)";
    if (field.type === "singleSelect") {
      const choices = (field.options as { choices?: { id: string; name: string }[] })?.choices ?? [];
      return choices.find((c) => c.id === bucket)?.name ?? String(bucket);
    }
    if (field.type === "checkbox") return bucket === true || bucket === "t" ? "Checked" : "Unchecked";
    return String(bucket);
  }

  private aggregateExpr(aggregation: DashboardWidget["aggregation"], fields: FieldRow[]) {
    if (aggregation.fn === "count") return sql`COUNT(*)`;
    if (!aggregation.fieldId) throw new BadRequestException(`Aggregation "${aggregation.fn}" requires a field`);
    const field = this.fieldById(fields, aggregation.fieldId);
    const expr = compileSortExpr(field);
    switch (aggregation.fn) {
      case "sum":
        return sql`SUM(${expr})`;
      case "avg":
        return sql`AVG(${expr})`;
      case "min":
        return sql`MIN(${expr})`;
      case "max":
        return sql`MAX(${expr})`;
    }
  }
}
