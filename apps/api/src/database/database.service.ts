import { AsyncLocalStorage } from "node:async_hooks";
import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Kysely, PostgresDialect, Transaction } from "kysely";
import { Pool } from "pg";
import { Database } from "./schema";

/**
 * Wraps the Kysely instance and exposes `.db` — either the pool-backed root
 * connection, or the active transaction, if `runInTransaction` has one open
 * on this async context. Services never need to thread a `trx` argument
 * through call chains; they just call `databaseService.db`.
 */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly pool: Pool;
  private readonly root: Kysely<Database>;
  private readonly als = new AsyncLocalStorage<Kysely<Database> | Transaction<Database>>();

  constructor(config: ConfigService) {
    this.pool = new Pool({
      connectionString: config.get<string>("DATABASE_URL"),
      max: 10,
    });
    this.root = new Kysely<Database>({
      dialect: new PostgresDialect({ pool: this.pool }),
    });
  }

  /** The connection to use for the current async context: the open
   * transaction if one exists, otherwise the pooled root connection. */
  get db(): Kysely<Database> | Transaction<Database> {
    return this.als.getStore() ?? this.root;
  }

  async runInTransaction<T>(fn: () => Promise<T>): Promise<T> {
    const existing = this.als.getStore();
    if (existing) {
      // Already inside a transaction on this async context — reuse it
      // rather than nesting (Postgres doesn't nest transactions natively;
      // savepoints are a later refinement if a real need arises).
      return fn();
    }
    return this.root.transaction().execute((trx) => this.als.run(trx, fn));
  }

  async onModuleDestroy() {
    await this.root.destroy();
  }
}
