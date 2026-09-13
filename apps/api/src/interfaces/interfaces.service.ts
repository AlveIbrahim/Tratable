import { Injectable, NotFoundException } from "@nestjs/common";
import { CreateInterfaceDto, makeId } from "@tratable/shared";
import { customAlphabet } from "nanoid";
import { DatabaseService } from "../database/database.service";

const shareTokenAlphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const generateShareToken = customAlphabet(shareTokenAlphabet, 32);

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || "interface"
  );
}

@Injectable()
export class InterfacesService {
  constructor(private readonly db: DatabaseService) {}

  async create(dto: CreateInterfaceDto) {
    const id = makeId("interface");
    const baseSlug = slugify(dto.name);
    let slug = baseSlug;
    let suffix = 1;
    while (
      await this.db.db
        .selectFrom("interfaces")
        .select("id")
        .where("base_id", "=", dto.baseId)
        .where("slug", "=", slug)
        .executeTakeFirst()
    ) {
      slug = `${baseSlug}-${++suffix}`;
    }

    await this.db.db
      .insertInto("interfaces")
      .values({ id, base_id: dto.baseId, name: dto.name, slug, is_published: false })
      .execute();
    return this.getOrThrow(id);
  }

  async listForBase(baseId: string) {
    return this.db.db
      .selectFrom("interfaces")
      .selectAll()
      .where("base_id", "=", baseId)
      .orderBy("created_at", "asc")
      .execute();
  }

  async getOrThrow(id: string) {
    const row = await this.db.db.selectFrom("interfaces").selectAll().where("id", "=", id).executeTakeFirst();
    if (!row) throw new NotFoundException("Interface not found");
    return row;
  }

  async rename(id: string, name: string) {
    await this.getOrThrow(id);
    await this.db.db
      .updateTable("interfaces")
      .set({ name, updated_at: new Date().toISOString() })
      .where("id", "=", id)
      .execute();
    return this.getOrThrow(id);
  }

  async remove(id: string) {
    await this.getOrThrow(id);
    await this.db.db.deleteFrom("interfaces").where("id", "=", id).execute();
  }

  /** Mints a share token if this interface has never had one, then marks it
   * published. Publishing twice is a no-op on the token — the link people
   * already have keeps working, which is what "publish" should mean as
   * opposed to "regenerate my link". */
  async publish(id: string) {
    const iface = await this.getOrThrow(id);
    const shareToken = iface.share_token ?? generateShareToken();
    await this.db.db
      .updateTable("interfaces")
      .set({ share_token: shareToken, is_published: true, updated_at: new Date().toISOString() })
      .where("id", "=", id)
      .execute();
    return this.getOrThrow(id);
  }

  async unpublish(id: string) {
    await this.getOrThrow(id);
    await this.db.db
      .updateTable("interfaces")
      .set({ is_published: false, updated_at: new Date().toISOString() })
      .where("id", "=", id)
      .execute();
    return this.getOrThrow(id);
  }

  /** Invalidates the old public link immediately — anyone with the previous
   * URL gets a 404 from the public module the moment this returns. */
  async regenerateToken(id: string) {
    await this.getOrThrow(id);
    await this.db.db
      .updateTable("interfaces")
      .set({ share_token: generateShareToken(), updated_at: new Date().toISOString() })
      .where("id", "=", id)
      .execute();
    return this.getOrThrow(id);
  }
}
