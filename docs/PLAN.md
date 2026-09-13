# Tratable — an Airtable-like CMS on Postgres + NestJS + Next.js

## Context

`/home/alve/projects/Tratable` is an empty repo (one commit, a one-line README). The goal is a self-hosted Airtable-style database CMS, deliberately scoped to three capabilities rather than cloning the whole product:

1. **Bases** — create bases, tables, fields, records; edit them in a spreadsheet grid.
2. **CSV import/export** — bring data in with type inference and column mapping, get it back out honoring the current view.
3. **Interfaces** — compose preset pages (grid, record detail, list, dashboard, form) bound to a table, and publish them via share link.

Explicitly out of scope for v1: automations, formulas/rollups/lookups, realtime multiplayer, sync integrations, revision history, Kanban/Calendar/Gantt views. The schema is designed so these can be added later without data migration.

**Decisions already made** (from planning Q&A):

| Decision | Choice | Why |
|---|---|---|
| Storage model | JSONB meta-model | Adding a field is an `INSERT`, not an `ALTER TABLE`. No DDL locks, no migration bookkeeping. |
| Frontend | Next.js 16 App Router | Reversed from the original "Astro" ask after establishing Next.js can't run as an Astro island. This is a logged-in interactive dashboard — Next's home turf. |
| Interfaces | Preset layouts | Page config still stored as a versioned discriminated union so a drag-drop canvas can be layered on later for free. |
| Auth | Multi-user workspaces | Email/password + JWT, per-workspace roles, plus anonymous access to published interfaces. |

**Environment:** Node 24.18, npm 11.16, PostgreSQL 18.6 running locally. No Docker, no pnpm — so npm workspaces and a local Postgres database, with an optional `docker-compose.yml` committed for anyone who does have Docker.

**Scale target:** 100k records/table, 200 fields/table, 50 tables/base. Everything below is designed against those numbers.

---

## Stack and pinned versions

Every version below was verified against the npm registry on 2026-09-13, not recalled from memory.

| Package | Version | Note |
|---|---|---|
| `next` | **16.3.5** | Latest major. There is no 17 — `canary` is only 16.4. Requires Node ≥20.9 ✓ |
| `react` / `react-dom` | **19.3.0** | |
| `@nestjs/core` / `@nestjs/common` | **12.0.1** | Latest major. Requires Node ≥20 ✓ |
| `@nestjs/cli` | 12.0.0 | |
| `typescript` | **6.0.x** | ⚠️ deliberately *not* latest — see below |
| `kysely` | 0.29.5 | |
| `pg` | 8.23.0 | |
| `zod` | 4.6.4 | |
| `nanoid` | 6.0.1 | ID generation |
| `argon2` | 0.45.1 | password hashing |
| `csv-parse` / `csv-stringify` | 7.0.2 / 6.8.3 | streaming, not `papaparse` — these handle backpressure properly for 500k-row files |
| `chardet` | 2.2.0 | encoding sniffing on import |
| `@nestjs/throttler` | 6.5.0 | rate limiting the public surface |
| `@nestjs/jwt` / `config` / `swagger` | 12.0.1 / 12.0.0 / 12.0.1 | |
| `@tanstack/react-query` | 5.102.8 | |
| `@tanstack/react-virtual` | 3.14.12 | grid row virtualization |
| `@dnd-kit/core` | 6.3.1 | column + field reordering |
| `zustand` | 5.0.15 | grid focus/selection state |
| `tailwindcss` | 4.3.3 | |
| `vitest` / `@playwright/test` | 5.0.0 / 1.63.0 | |

### Why TypeScript 6, when 7.0.2 is latest

TypeScript 7 is the native Go compiler rewrite. It is genuinely the latest release — but **`@nestjs/cli@12` pins `typescript: ~6.0.2`**, and that pin is the tell. NestJS is built on legacy decorators plus `emitDecoratorMetadata`, which is how its entire DI container resolves constructor parameter types at runtime. That is the exact corner of the language the native port has been slowest to settle. Adopting TS 7 here means betting the DI layer on it.

So: **TypeScript 6.0.x across the whole monorepo**, matching what the Nest CLI itself ships with. `packages/shared` is consumed by both apps, which is precisely why the version shouldn't be split — a shared package compiled by two different compilers is a debugging problem nobody wants.

Revisit TS 7 once `@nestjs/cli` bumps its own pin. That's the signal to watch, and the upgrade should be a one-line change by then. The web app alone could run TS 7 today (Next needs no decorator metadata), but the consistency is worth more than the compile speed at this size.

`@tanstack/react-table` is at 9.2.4 but is **not** in the dependency list — the grid needs virtualization and a custom focus model, not table state management. Pulling it in would mean fighting its row model for features we're hand-rolling anyway.

---

## Repository layout

```
Tratable/
├── package.json                 # npm workspaces root
├── apps/
│   ├── api/                     # NestJS 12
│   └── web/                     # Next.js 16 (App Router, React 19.3)
└── packages/
    └── shared/                  # field-type registry, zod schemas, API DTO types
```

`packages/shared` is imported by both apps. It is not just types — it holds the **field-type registry**, which is the single most important abstraction in the project (see below). Both the API (validation, CSV parsing, SQL compilation) and the web app (cell renderers, editors, import wizard) drive off the same registry, so a new field type is added in one place.

---

## Database schema

All IDs are **prefixed nanoids as `text`**, not UUIDs: `usr_`, `wsp_`, `bas_`, `tbl_`, `fld_`, `rec_`, `viw_`, `itf_`, `pag_`, `opt_`. This keeps JSONB payloads compact, makes logs and `psql` output readable, and matches Airtable's own convention.

### Metadata tables

```sql
users(id, email citext unique, password_hash, name, created_at, updated_at)

workspaces(id, name, slug citext unique, owner_id → users, created_at)

workspace_members(workspace_id, user_id, role, PRIMARY KEY(workspace_id, user_id))
  -- role: 'owner' | 'admin' | 'editor' | 'viewer'

bases(id, workspace_id → workspaces, name, icon, color, created_at, updated_at, deleted_at)

tables(id, base_id → bases, name, description, pos float8,
       primary_field_id, created_at, updated_at, deleted_at)
  UNIQUE(base_id, name) WHERE deleted_at IS NULL

fields(id, table_id → tables, name, type, options jsonb DEFAULT '{}',
       pos float8, created_at, updated_at, deleted_at)
  UNIQUE(table_id, name) WHERE deleted_at IS NULL

views(id, table_id → tables, name, type, config jsonb, pos float8, created_at, updated_at)
  -- config: { filters, sorts, fieldOrder[], hiddenFieldIds[], rowHeight, groupByFieldId }

interfaces(id, base_id → bases, name, slug, share_token unique NULL,
           is_published bool, created_at, updated_at)

interface_pages(id, interface_id → interfaces, name, slug, type, config jsonb, pos float8)

import_jobs(id, base_id, table_id NULL, filename, original_name, status,
            mapping jsonb, stats jsonb, error_report_path, created_by, created_at, completed_at)

refresh_tokens(id, user_id, token_hash, expires_at, revoked_at, created_at)

attachments(id, base_id, field_id, record_id, filename, mime_type, size_bytes, storage_path, created_at)
```

### The data table

```sql
records(
  id          text PRIMARY KEY,
  table_id    text NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  data        jsonb NOT NULL DEFAULT '{}',
  pos         float8 NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  text REFERENCES users(id),
  updated_by  text REFERENCES users(id),
  deleted_at  timestamptz
);

CREATE INDEX ON records (table_id, pos, id) WHERE deleted_at IS NULL;
CREATE INDEX ON records USING gin (data jsonb_path_ops);
```

**`data` is keyed by field ID, never field name.** Renaming a field then costs one metadata `UPDATE` and touches zero rows. This is the decision that makes the whole model viable — get it wrong and every rename becomes a 100k-row rewrite.

### Links between records

`linkToRecord` values are stored inline as an array of record IDs on the owning record (`{"fld_x": ["rec_a", "rec_b"]}`), with a **symmetric field** on the linked table kept in sync inside the same transaction. This avoids a join table for v1. The GIN index makes "which records link to `rec_a`" a fast containment query: `data->'fld_x' @> '"rec_a"'`.

### Migrations

Plain numbered SQL files in `apps/api/migrations/NNN_name.sql`, applied by a ~60-line runner that tracks applied versions in a `schema_migrations` table. No ORM migration layer — the schema is small and fixed, and dynamic-DDL complexity was exactly what the JSONB model bought us out of.

**Database access: Kysely** (typed SQL query builder) over the `pg` driver. Not Prisma or TypeORM: the core of this app is a *dynamically compiled* JSONB filter/sort query, which heavy ORMs express badly or not at all. Kysely gives type safety on the fixed metadata tables and drops cleanly to raw SQL fragments where the query compiler needs them.

---

## The field-type registry (`packages/shared/src/fields/`)

Every field type implements one interface. This is the backbone — CSV import, CSV export, validation, filtering, sorting, and UI rendering all dispatch through it.

```ts
interface FieldTypeDef<TValue, TOptions> {
  type: FieldType;
  defaultOptions: TOptions;

  // write path
  validate(value: unknown, opts: TOptions): Result<TValue | null>;

  // CSV
  parseFromCsv(raw: string, opts: TOptions, ctx: ImportCtx): Result<TValue | null>;
  formatToCsv(value: TValue | null, opts: TOptions, ctx: ExportCtx): string;
  inferFromSamples(samples: string[]): { options: TOptions; confidence: number } | null;

  // SQL
  sortExpr(fieldId: string): RawSql;
  filterExpr(fieldId: string, op: FilterOp, operand: unknown): RawSql;
  supportedOps: FilterOp[];
}
```

### v1 field types

| Type | JSONB shape | Notes |
|---|---|---|
| `singleLineText` | `"Acme"` | |
| `longText` | `"..."` | |
| `number` | `42.5` | opts: precision, format (decimal/integer/currency/percent) |
| `checkbox` | `true` | |
| `singleSelect` | `"opt_ab12"` | stores choice **id**; renaming a choice doesn't touch rows |
| `multiSelect` | `["opt_ab12","opt_cd34"]` | |
| `date` | `"2026-09-13"` | opts: dateFormat |
| `dateTime` | `"2026-09-13T10:00:00Z"` | opts: includeTime, timeZone |
| `email` / `url` / `phone` | `"..."` | text with format validation |
| `attachment` | `[{id,filename,url,size,mimeType}]` | local disk in v1 |
| `linkToRecord` | `["rec_x"]` | opts: linkedTableId, symmetricFieldId, allowMultiple |
| `autoNumber` | `7` | assigned server-side on insert |
| `createdTime` / `lastModifiedTime` | computed from columns | not stored in `data` |

Deferred to a later phase: `formula`, `rollup`, `lookup`, `user`, `rating`, `duration`, `barcode`.

---

## The query engine (`apps/api/src/query/`)

A pure, side-effect-free compiler from a filter tree to parameterized SQL. **Highest-value unit tests in the codebase live here.**

```ts
type FilterNode =
  | { conjunction: 'and' | 'or'; children: FilterNode[] }
  | { fieldId: string; op: FilterOp; value?: unknown };
```

Compiles to, for example:

| Filter | SQL fragment |
|---|---|
| text contains | `data->>'fld_a1' ILIKE '%' \|\| $1 \|\| '%'` |
| number > | `JSON_VALUE(data, '$.fld_b2' RETURNING numeric NULL ON ERROR) > $1` |
| singleSelect is | `data->>'fld_c3' = $1` |
| multiSelect has any | `data->'fld_d4' ?\| $1::text[]` |
| checkbox is checked | `(data->'fld_e5')::boolean IS TRUE` |
| date is after | `JSON_VALUE(data, '$.fld_f6' RETURNING timestamptz NULL ON ERROR) > $1` |
| is empty | `data->'fld_x' IS NULL OR data->>'fld_x' = ''` |

Three non-negotiable rules:

1. **Never interpolate strings.** Field IDs are validated against that table's field list; operators against `supportedOps` for the field's type; values always bound as parameters. A filter tree arrives from the client and is fully untrusted.
2. **Safe casts.** `('abc')::numeric` raises and kills the whole query. Postgres 18's `JSON_VALUE(... RETURNING numeric NULL ON ERROR)` degrades to NULL instead. Write-time validation is still the primary defense; this is belt-and-braces for legacy/imported rows.
3. **Keyset pagination, never `OFFSET`.** Cursor is `(sortValue, id)` — opaque base64 to the client. `OFFSET 90000` on a 100k table will crawl.

**Row ordering** uses fractional `pos`: inserting between neighbors takes their midpoint. A rebalance routine renumbers a table's rows to evenly spaced integers when the gap falls below `1e-9` (roughly 50 consecutive insertions at the same spot).

**Indexing strategy:** the GIN index serves containment (`@>`, `?|`) — equality on select fields, link lookups. It does *not* help ranges, `ILIKE`, or sorts. For those, an admin endpoint creates per-field expression B-tree indexes on demand for hot views, plus `pg_trgm` GIN indexes for text `contains` on large tables. Ship this in the hardening phase against real query plans, not speculatively.

---

## CSV import

A four-step wizard, backed by a job record so large files survive a page reload.

**1. Upload** — `POST /api/imports` (multipart). Stream to `uploads/imports/`. Sniff encoding (BOM / UTF-16 via `chardet`) and delimiter. Never read the whole file into memory.

**2. Analyze** — parse the header plus the first 500 rows. Return per-column samples and an inferred type. Inference is tried in order, first match wins:

```
checkbox → number → date/dateTime → email → url → phone
→ singleSelect (distinct values ≤ 20 AND ≤ 50% of sampled rows)
→ singleLineText (fallback)
```

**3. Map** — the user confirms each column in the UI: create a new field (type editable), map to an existing field, or skip. Plus a target mode:

- **Create new table** from the CSV
- **Append** rows to an existing table
- **Upsert** on a chosen key field — matching rows update, others insert

**4. Execute** — a background job streams the file, batching 1000 rows per transaction. Per-cell parsing goes through `parseFromCsv`. **A bad cell does not fail the import** — it is recorded as `{row, column, rawValue, reason}` and the cell is left empty. On completion the user gets counts plus a downloadable **error-report CSV** of failed rows, formatted for fixing and re-importing.

Progress via polling `GET /api/imports/:id` (a status/percent field). SSE is a later refinement, not a v1 requirement.

Guardrails: 50MB and 500k-row default caps (configurable), per-batch commits so no single transaction runs for minutes, and a hard cap on new fields created per import.

## CSV export

`GET /api/tables/:id/export?viewId=…&format=csv|json`

- **Streams** via a Postgres cursor + NestJS `StreamableFile` — memory stays flat at 100k rows.
- Honors the view's filters, sorts, field order, and hidden fields. Exporting "what I'm looking at" is the whole point.
- Headers are field **names**; cells are rendered by `formatToCsv`, so dates use the field's format, `singleSelect` exports the choice *name* (not `opt_` id), `multiSelect` comma-joins, `attachment` emits URLs, and `linkToRecord` emits the linked records' primary-field values.
- `GET /api/bases/:id/export` streams a zip of one CSV per table.

Round-tripping is a design requirement: exporting a table and re-importing it must reproduce the same data. This is a good E2E test.

---

## Interfaces

Five preset page types. Config is a versioned discriminated union so a canvas builder can be added later without migrating stored pages.

```ts
type PageConfig =
  | { v: 1; type: 'grid'; tableId; viewId?; visibleFieldIds[]; filters;
      allowEdit: boolean; allowCreate: boolean; allowDelete: boolean }
  | { v: 1; type: 'record_detail'; tableId; recordSelector: 'url_param' | 'picker';
      sections: { title: string; fieldIds: string[] }[] }
  | { v: 1; type: 'list'; tableId; viewId?; titleFieldId; subtitleFieldId?;
      imageFieldId?; filters }
  | { v: 1; type: 'dashboard'; widgets: {
      type: 'number' | 'bar' | 'line' | 'pie'; tableId;
      aggregation: { fn: 'count'|'sum'|'avg'|'min'|'max'; fieldId? };
      groupByFieldId?; filters }[] }
  | { v: 1; type: 'form'; tableId; fields: { fieldId; label; required; helpText }[];
      submitText; successMessage; redirectUrl? };
```

Each page type has exactly one React renderer component, used by **both** the authenticated builder preview and the public published page. One renderer, two mount points — no drift between preview and production.

### Publishing and the public surface

This is the main security boundary in the product and deserves its own module (`apps/api/src/public/`), separate from the authenticated API.

- Publishing mints `interfaces.share_token` (32-char nanoid). Public URL: `/s/:token/:pageSlug`.
- The public controller resolves token → interface → pages, and serves data **only** through the page config.
- **Field-level allowlist enforced server-side.** A public grid page returns only the fields in `visibleFieldIds`. The client never names the fields it wants — it asks for "page `pag_x`, rows 0–50" and the server decides. A client-supplied field list here would be a data leak.
- Page filters are applied as **mandatory** server-side predicates, ANDed with anything else, and cannot be relaxed by query params.
- Forms accept writes only to `config.fields[].fieldId`; every other key in the body is dropped, not rejected silently but logged. Rate-limited per IP via `@nestjs/throttler`.
- Revoking a share regenerates the token.

---

## API module layout

```
apps/api/src/
├── common/        guards, zod validation pipe, exception filter, pagination helpers
├── database/      pg Pool, Kysely instance, migration runner, tx helper (AsyncLocalStorage)
├── auth/          register, login, refresh, JwtAuthGuard (global) + @Public()
├── workspaces/    workspaces + members + WorkspaceRoleGuard
├── bases/
├── tables/
├── fields/        CRUD + type-change migration strategy
├── records/       CRUD, bulk ops, cell updates
├── views/
├── query/         filter/sort → SQL compiler (pure, unit-tested)
├── csv/           import (upload/analyze/execute) + streaming export
├── interfaces/    interfaces + pages CRUD, publish/unpublish
├── public/        share-token resolved; read-only + form submit
└── attachments/   StorageService interface, LocalDiskStorage impl (S3 drops in later)
```

**Authorization**: `JwtAuthGuard` global with a `@Public()` opt-out. A `WorkspaceRoleGuard` + `@RequireRole('editor')` resolves any route's resource to a workspace membership. Because a request for `rec_x` must walk record → table → base → workspace → membership, do it in **one CTE query** and memoize per request — a naive four-query walk on every record write is the easiest accidental performance disaster here.

Passwords: **argon2id**. Access JWT 15 min; refresh token 30 days in an httpOnly cookie, rotated on use, stored hashed in `refresh_tokens` so sessions are revocable.

---

## Frontend (`apps/web`)

```
src/
├── app/
│   ├── (auth)/login, register
│   ├── (app)/
│   │   ├── layout.tsx                    sidebar: workspaces + bases
│   │   ├── w/[workspaceId]/page.tsx      base list
│   │   └── b/[baseId]/
│   │       ├── layout.tsx                table tabs, base nav
│   │       ├── t/[tableId]/page.tsx      ← the grid
│   │       └── i/[interfaceId]/…         interface builder
│   └── s/[token]/[[...page]]/page.tsx    public published pages (no auth)
├── components/
│   ├── grid/        DataGrid, Row, Cell, editors/<per field type>, HeaderMenu, FilterBar
│   ├── fields/      field create/edit dialog, type picker, per-type option forms
│   ├── import/      wizard: Upload → Map → Preview → Run → Report
│   ├── interfaces/  per-page-type config forms + renderers (shared with /s)
│   └── ui/          shadcn/ui primitives
└── lib/             typed API client (from packages/shared), TanStack Query hooks
```

**The grid** is the hard part and should be budgeted accordingly:

- **TanStack Virtual** for row virtualization; column virtualization only if >30 fields.
- Focus/selection as an explicit state machine (`{rowId, fieldId, mode: 'nav' | 'edit'}`) driving arrows / Tab / Enter / Escape. Ad-hoc focus handling is where grid implementations rot.
- One editor component per field type, resolved through the shared registry.
- Optimistic cell writes via TanStack Query `onMutate` + rollback on error, debounced ~300ms.
- Column resize/reorder persisted to the view config.

**Auth wiring**: run NestJS on `:3001` and proxy `/api/*` from Next via `rewrites`, so the refresh cookie stays first-party and no CORS/SameSite workarounds are needed. Worth getting right in Phase 0 — retrofitting cookie auth across origins later is unpleasant.

**Next 16 specifics that matter here:**

- Turbopack is the default bundler in 16. Fine for this app; no custom webpack config is needed anywhere in the plan.
- Resist `use cache` / Cache Components for anything in the builder UI. Base, table, and record data is per-user, permission-scoped, and mutated constantly — it is dynamic by nature, and caching it is how you ship a bug where one user sees another's rows. The one legitimate place for caching is the **public published page** (`/s/:token`), where content is genuinely shared across anonymous viewers; cache that with a tag and revalidate on record write.
- Server Components for the shells (workspace list, base list, table tabs, interface chrome); the grid and editors are client components. The boundary sits at the grid container.

---

## Build phases

| # | Phase | Delivers |
|---|---|---|
| 0 | Scaffold | npm workspaces, NestJS 12 + Next 16 apps on pinned TS 6, Postgres DB, migration runner, shared package, env config, `/api` proxy, lint/format |
| 1 | Auth & workspaces | register/login/refresh, argon2id, guards, workspace + member CRUD |
| 2 | Schema layer | bases, tables, fields, field-type registry, views metadata |
| 3 | Records & query engine | record CRUD + bulk, filter/sort compiler, keyset pagination, `pos` ordering |
| 4 | Grid UI | app shell, base/table nav, virtualized editable grid, field editors, filter/sort bar |
| 5 | CSV import | upload → analyze → map → execute, background job, error report |
| 6 | CSV export | streaming view-aware export, base zip export, round-trip test |
| 7 | Interfaces | page CRUD, 5 preset types, builder UI, renderers |
| 8 | Publish | share tokens, public API namespace, public renderer, form submit, throttling |
| 9 | Hardening | expression indexes against real plans, link-field N+1, error handling, seed script, README |

Phases 1–3 are backend-only and testable via HTTP before any UI exists. Phase 4 is the single largest chunk of work.

**Later, unblocked by this schema:** formula/rollup/lookup engine, realtime collaboration (WebSocket + Postgres `LISTEN/NOTIFY`), Kanban/Calendar views, record comments, revision history, S3 attachments, drag-drop interface canvas.

---

## Known risks and their mitigations

| Risk | Mitigation |
|---|---|
| Numeric/date casts on dirty JSONB abort queries | Validate on write; `JSON_VALUE … NULL ON ERROR` as backstop |
| GIN index doesn't serve sorts or `ILIKE` | Per-field expression indexes + `pg_trgm`, added in Phase 9 against real plans |
| `pos` gaps exhaust float precision | Rebalance routine below `1e-9` |
| Field **type change** (unlike rename) needs data conversion | Explicit strategy per type pair: convert, or null-out with a preview of affected row count before applying |
| Deleted fields leave orphan JSONB keys | Soft-delete metadata; periodic job strips keys with `data - 'fld_x'` |
| Permission walk on every record op | Single CTE, memoized per request |
| Public pages leaking hidden fields | Server-side field allowlist from page config; client never names fields |
| Large imports holding one long transaction | 1000-row batches, commit per batch |
| TS 7 (native compiler) breaking Nest's decorator metadata | Pin TS 6.0.x monorepo-wide, matching `@nestjs/cli`'s own pin; upgrade when Nest bumps it |

---

## Verification

**Unit** (Vitest, in `packages/shared` and `apps/api/src/query`)
- Field codecs: `validate` / `parseFromCsv` / `formatToCsv` / `inferFromSamples` per type, including junk input.
- Query compiler: filter tree → SQL snapshot tests, one per operator per field type. Plus an injection suite feeding hostile field IDs, operators, and values.

**Integration** (Jest + supertest, real Postgres test DB, migrations per suite)
- Auth flow including refresh rotation and revocation.
- Records CRUD with filters, sorts, and cursor pagination across page boundaries.
- Import of a deliberately messy CSV: mixed encodings, quoted commas, empty cells, bad dates — assert the error report contents, not just the pass count.
- **Public endpoint negative tests**: confirm a hidden field never appears in a `/s/:token` response, and that a form submit to a non-config field is dropped.

**E2E** (Playwright) — one flow covers the entire product:
```
register → create base → import CSV (new table) → verify inferred types
→ edit a cell → add a field → filter + sort the view
→ build an interface (grid + form) → publish
→ open /s/:token anonymously → submit the form
→ export CSV → re-import → assert round-trip equality
```

**Manual**
```bash
npm run dev          # api :3001 + web :3000
npm run migrate      # apply migrations
npm run seed         # demo workspace, base, 5k-row table
npm test             # unit + integration
npm run test:e2e     # Playwright
```

A seed script generating a 100k-row table is worth writing in Phase 3 — grid virtualization and query performance claims mean nothing until tested against real volume.
