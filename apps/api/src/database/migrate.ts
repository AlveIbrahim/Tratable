/* eslint-disable no-console */
import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { Pool } from "pg";

const MIGRATIONS_DIR = path.join(__dirname, "..", "..", "migrations");

async function ensureMigrationsTable(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

function listMigrationFiles(): string[] {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql") && !f.endsWith(".down.sql"))
    .sort();
}

async function up(pool: Pool) {
  await ensureMigrationsTable(pool);
  const { rows } = await pool.query<{ version: string }>("SELECT version FROM schema_migrations");
  const applied = new Set(rows.map((r) => r.version));

  const files = listMigrationFiles();
  let ranAny = false;
  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    if (applied.has(version)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    console.log(`Applying ${file}...`);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version]);
      await client.query("COMMIT");
      ranAny = true;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  console.log(ranAny ? "Migrations applied." : "Already up to date.");
}

async function down(pool: Pool) {
  await ensureMigrationsTable(pool);
  const { rows } = await pool.query<{ version: string }>(
    "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1",
  );
  if (rows.length === 0) {
    console.log("Nothing to roll back.");
    return;
  }
  const version = rows[0].version;
  const downFile = path.join(MIGRATIONS_DIR, `${version}.down.sql`);
  if (!fs.existsSync(downFile)) {
    throw new Error(`No down migration found for ${version} (expected ${downFile})`);
  }
  const sql = fs.readFileSync(downFile, "utf8");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("DELETE FROM schema_migrations WHERE version = $1", [version]);
    await client.query("COMMIT");
    console.log(`Rolled back ${version}.`);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function main() {
  const direction = process.argv[2];
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    if (direction === "down") await down(pool);
    else await up(pool);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
