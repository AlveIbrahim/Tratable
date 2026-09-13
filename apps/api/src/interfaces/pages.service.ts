import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CreatePageDto, DashboardWidget, makeId, UpdatePageDto } from "@tratable/shared";
import { DatabaseService } from "../database/database.service";
import { DashboardService } from "../query/dashboard.service";

const POS_STEP = 65536;

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || "page"
  );
}

@Injectable()
export class PagesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly dashboard: DashboardService,
  ) {}

  async create(dto: CreatePageDto) {
    const id = makeId("page");
    const baseSlug = slugify(dto.name);
    let slug = baseSlug;
    let suffix = 1;
    while (
      await this.db.db
        .selectFrom("interface_pages")
        .select("id")
        .where("interface_id", "=", dto.interfaceId)
        .where("slug", "=", slug)
        .executeTakeFirst()
    ) {
      slug = `${baseSlug}-${++suffix}`;
    }

    const max = await this.db.db
      .selectFrom("interface_pages")
      .select(({ fn }) => fn.max("pos").as("maxPos"))
      .where("interface_id", "=", dto.interfaceId)
      .executeTakeFirst();
    const pos = (Number(max?.maxPos) || 0) + POS_STEP;

    await this.db.db
      .insertInto("interface_pages")
      .values({
        id,
        interface_id: dto.interfaceId,
        name: dto.name,
        slug,
        type: dto.config.type,
        config: JSON.stringify(dto.config),
        pos,
      })
      .execute();
    return this.getOrThrow(id);
  }

  async listForInterface(interfaceId: string) {
    return this.db.db
      .selectFrom("interface_pages")
      .selectAll()
      .where("interface_id", "=", interfaceId)
      .orderBy("pos", "asc")
      .execute();
  }

  async getOrThrow(id: string) {
    const row = await this.db.db.selectFrom("interface_pages").selectAll().where("id", "=", id).executeTakeFirst();
    if (!row) throw new NotFoundException("Page not found");
    return row;
  }

  async update(id: string, dto: UpdatePageDto) {
    await this.getOrThrow(id);
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.pos !== undefined) patch.pos = dto.pos;
    if (dto.config !== undefined) {
      patch.config = JSON.stringify(dto.config);
      patch.type = dto.config.type;
    }
    await this.db.db.updateTable("interface_pages").set(patch).where("id", "=", id).execute();
    return this.getOrThrow(id);
  }

  async remove(id: string) {
    await this.getOrThrow(id);
    await this.db.db.deleteFrom("interface_pages").where("id", "=", id).execute();
  }

  /** Lets the builder show real numbers in a dashboard's preview *before*
   * publishing/saving — computed against whatever widget list the editor
   * currently has in memory, not what's persisted. `@RequireRole("viewer")`
   * + `@ResourceParam("page", ...)` on the controller already proves the
   * caller can see this page; the check here additionally proves every
   * table a widget references belongs to the *same base* as this page, so a
   * crafted request can't probe aggregate data on a table in a base the
   * caller was never granted access to just by naming its id in a widget. */
  async previewDashboard(pageId: string, widgets: DashboardWidget[]) {
    const page = await this.getOrThrow(pageId);
    const iface = await this.db.db
      .selectFrom("interfaces")
      .select("base_id")
      .where("id", "=", page.interface_id)
      .executeTakeFirstOrThrow();

    const tableIds = [...new Set(widgets.map((w) => w.tableId))];
    if (tableIds.length > 0) {
      const owned = await this.db.db
        .selectFrom("tables")
        .select("id")
        .where("id", "in", tableIds)
        .where("base_id", "=", iface.base_id)
        .execute();
      const ownedIds = new Set(owned.map((t) => t.id));
      const foreign = tableIds.filter((id) => !ownedIds.has(id));
      if (foreign.length > 0) {
        throw new BadRequestException(`Table(s) not in this interface's base: ${foreign.join(", ")}`);
      }
    }

    const results: Awaited<ReturnType<DashboardService["computeWidget"]>>[] = [];
    for (const widget of widgets) {
      results.push(await this.dashboard.computeWidget(widget));
    }
    return { widgets: results };
  }
}
