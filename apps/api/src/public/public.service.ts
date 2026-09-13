import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PageConfig } from "@tratable/shared";
import { DatabaseService } from "../database/database.service";
import { FieldsService } from "../fields/fields.service";
import { RecordsService } from "../records/records.service";
import { DashboardService } from "../query/dashboard.service";

/**
 * The entire public (unauthenticated) read/write surface for a published
 * interface. This is the security boundary described in docs/PLAN.md:
 * everything here is reachable with no login, gated only by knowing a
 * 32-char share token, so every method re-derives what's allowed from the
 * page's own config rather than trusting anything the caller passes in.
 */
@Injectable()
export class PublicService {
  constructor(
    private readonly db: DatabaseService,
    private readonly fields: FieldsService,
    private readonly records: RecordsService,
    private readonly dashboard: DashboardService,
  ) {}

  private async resolveInterface(token: string) {
    const iface = await this.db.db
      .selectFrom("interfaces")
      .selectAll()
      .where("share_token", "=", token)
      .where("is_published", "=", true)
      .executeTakeFirst();
    if (!iface) throw new NotFoundException("This link is not published (or never existed)");
    return iface;
  }

  private async resolvePage(token: string, pageSlug: string) {
    const iface = await this.resolveInterface(token);
    const page = await this.db.db
      .selectFrom("interface_pages")
      .selectAll()
      .where("interface_id", "=", iface.id)
      .where("slug", "=", pageSlug)
      .executeTakeFirst();
    if (!page) throw new NotFoundException("Page not found");
    return { iface, page, config: page.config as unknown as PageConfig };
  }

  /** Every field this page config could legitimately show — the allowlist
   * every other method here filters record data down to. Never derived from
   * anything the client sends. */
  private allowedFieldIds(config: PageConfig): string[] {
    switch (config.type) {
      case "grid":
        return config.visibleFieldIds;
      case "list":
        return [config.titleFieldId, config.subtitleFieldId, config.imageFieldId].filter((x): x is string => !!x);
      case "record_detail":
        return config.sections.flatMap((s) => s.fieldIds);
      case "form":
        return config.fields.map((f) => f.fieldId);
      case "dashboard":
        return []; // dashboard exposes only aggregates, never row-level field values
    }
  }

  private pickAllowed(data: Record<string, unknown>, allowedIds: Set<string>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (allowedIds.has(k)) out[k] = v;
    }
    return out;
  }

  async getInterface(token: string) {
    const iface = await this.resolveInterface(token);
    const pages = await this.db.db
      .selectFrom("interface_pages")
      .select(["id", "name", "slug", "type", "pos"])
      .where("interface_id", "=", iface.id)
      .orderBy("pos", "asc")
      .execute();
    return { id: iface.id, name: iface.name, pages };
  }

  async getPage(token: string, pageSlug: string) {
    const { config } = await this.resolvePage(token, pageSlug);
    const tableId = "tableId" in config ? config.tableId : undefined;
    const allowedIds = new Set(this.allowedFieldIds(config));
    const fields = tableId
      ? (await this.fields.listForTable(tableId)).filter((f) => allowedIds.has(f.id))
      : [];
    return { config, fields: fields.map((f) => ({ id: f.id, name: f.name, type: f.type, options: f.options })) };
  }

  async listRecords(token: string, pageSlug: string, cursor: string | undefined, limit: number) {
    const { config } = await this.resolvePage(token, pageSlug);
    if (config.type !== "grid" && config.type !== "list") {
      throw new BadRequestException("This page type has no record list");
    }
    const allowedIds = new Set(this.allowedFieldIds(config));
    const sorts = config.type === "grid" ? undefined : undefined; // list/grid pages don't carry their own sort in v1; ordering follows pos
    const result = await this.records.list(config.tableId, {
      filters: config.filters,
      sorts,
      cursor,
      limit: Math.min(limit, 200),
    });
    return {
      records: result.records.map((r) => ({
        id: r.id,
        data: this.pickAllowed(r.data as Record<string, unknown>, allowedIds),
      })),
      nextCursor: result.nextCursor,
    };
  }

  async getRecord(token: string, pageSlug: string, recordId: string) {
    const { config } = await this.resolvePage(token, pageSlug);
    if (config.type !== "record_detail") throw new BadRequestException("This page type has no single-record view");
    const allowedIds = new Set(this.allowedFieldIds(config));
    const record = await this.records.getOrThrow(recordId);
    if (record.table_id !== config.tableId) throw new NotFoundException("Record not found on this page");
    return { id: record.id, data: this.pickAllowed(record.data as Record<string, unknown>, allowedIds) };
  }

  /** Drops every key not named in the form's own config.fields — a client
   * cannot write to a field the page author didn't explicitly add to the
   * form, no matter what it sends. */
  async submitForm(token: string, pageSlug: string, body: Record<string, unknown>) {
    const { config } = await this.resolvePage(token, pageSlug);
    if (config.type !== "form") throw new BadRequestException("This page type does not accept submissions");

    const allowed = new Set(config.fields.map((f) => f.fieldId));
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body ?? {})) {
      if (allowed.has(k)) data[k] = v;
    }
    for (const f of config.fields) {
      if (f.required && (data[f.fieldId] === undefined || data[f.fieldId] === null || data[f.fieldId] === "")) {
        throw new BadRequestException(`"${f.label}" is required`);
      }
    }
    const record = await this.records.create(config.tableId, null, { data });
    return { id: record.id, successMessage: config.successMessage, redirectUrl: config.redirectUrl };
  }

  async getDashboard(token: string, pageSlug: string) {
    const { config } = await this.resolvePage(token, pageSlug);
    if (config.type !== "dashboard") throw new BadRequestException("This page type has no dashboard data");

    const results: Awaited<ReturnType<DashboardService["computeWidget"]>>[] = [];
    for (const widget of config.widgets) {
      results.push(await this.dashboard.computeWidget(widget));
    }
    return { widgets: results };
  }
}
