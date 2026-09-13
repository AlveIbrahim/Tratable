-- Core schema: metadata tables (fixed) + records (JSONB meta-model).
-- See docs/PLAN.md for the design rationale.

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE users (
  id text PRIMARY KEY,
  email citext UNIQUE NOT NULL,
  password_hash text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE workspaces (
  id text PRIMARY KEY,
  name text NOT NULL,
  slug citext UNIQUE NOT NULL,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE workspace_members (
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);
CREATE INDEX workspace_members_user_idx ON workspace_members (user_id);

CREATE TABLE bases (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  icon text,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX bases_workspace_idx ON bases (workspace_id) WHERE deleted_at IS NULL;

CREATE TABLE tables (
  id text PRIMARY KEY,
  base_id text NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  pos double precision NOT NULL DEFAULT 0,
  primary_field_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE UNIQUE INDEX tables_base_name_uidx ON tables (base_id, name) WHERE deleted_at IS NULL;
CREATE INDEX tables_base_idx ON tables (base_id, pos) WHERE deleted_at IS NULL;

CREATE TABLE fields (
  id text PRIMARY KEY,
  table_id text NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL,
  options jsonb NOT NULL DEFAULT '{}',
  pos double precision NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE UNIQUE INDEX fields_table_name_uidx ON fields (table_id, name) WHERE deleted_at IS NULL;
CREATE INDEX fields_table_idx ON fields (table_id, pos) WHERE deleted_at IS NULL;

ALTER TABLE tables
  ADD CONSTRAINT tables_primary_field_fk
  FOREIGN KEY (primary_field_id) REFERENCES fields(id) ON DELETE SET NULL;

CREATE TABLE views (
  id text PRIMARY KEY,
  table_id text NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'grid',
  config jsonb NOT NULL DEFAULT '{}',
  pos double precision NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX views_table_idx ON views (table_id, pos);

CREATE TABLE records (
  id text PRIMARY KEY,
  table_id text NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}',
  pos double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text REFERENCES users(id) ON DELETE SET NULL,
  updated_by text REFERENCES users(id) ON DELETE SET NULL,
  deleted_at timestamptz
);
CREATE INDEX records_table_pos_idx ON records (table_id, pos, id) WHERE deleted_at IS NULL;
CREATE INDEX records_data_gin_idx ON records USING gin (data jsonb_path_ops);

CREATE TABLE interfaces (
  id text PRIMARY KEY,
  base_id text NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  share_token text UNIQUE,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX interfaces_base_slug_uidx ON interfaces (base_id, slug);

CREATE TABLE interface_pages (
  id text PRIMARY KEY,
  interface_id text NOT NULL REFERENCES interfaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  type text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}',
  pos double precision NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX interface_pages_slug_uidx ON interface_pages (interface_id, slug);

CREATE TABLE import_jobs (
  id text PRIMARY KEY,
  base_id text NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  table_id text REFERENCES tables(id) ON DELETE SET NULL,
  filename text NOT NULL,
  original_name text NOT NULL,
  status text NOT NULL DEFAULT 'uploaded',
  mapping jsonb,
  stats jsonb,
  error_report_path text,
  created_by text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX import_jobs_base_idx ON import_jobs (base_id, created_at DESC);

CREATE TABLE refresh_tokens (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id);

CREATE TABLE attachments (
  id text PRIMARY KEY,
  base_id text NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  field_id text NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  record_id text NOT NULL REFERENCES records(id) ON DELETE CASCADE,
  filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX attachments_record_idx ON attachments (record_id);
