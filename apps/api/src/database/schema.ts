import { ColumnType, Generated, Insertable, Selectable, Updateable } from "kysely";

/** Kysely's compile-time view of the metadata tables. `records.data` is typed
 * as unknown JSONB — the field registry (packages/shared) is the runtime
 * authority on its shape, not the database layer. */
export interface Database {
  users: UsersTable;
  workspaces: WorkspacesTable;
  workspace_members: WorkspaceMembersTable;
  bases: BasesTable;
  tables: TablesTable;
  fields: FieldsTable;
  views: ViewsTable;
  records: RecordsTable;
  interfaces: InterfacesTable;
  interface_pages: InterfacePagesTable;
  import_jobs: ImportJobsTable;
  refresh_tokens: RefreshTokensTable;
  attachments: AttachmentsTable;
  schema_migrations: SchemaMigrationsTable;
}

export interface UsersTable {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}
export type User = Selectable<UsersTable>;
export type NewUser = Insertable<UsersTable>;

export interface WorkspacesTable {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  created_at: ColumnType<Date, string | undefined, never>;
}
export type Workspace = Selectable<WorkspacesTable>;
export type NewWorkspace = Insertable<WorkspacesTable>;

export interface WorkspaceMembersTable {
  workspace_id: string;
  user_id: string;
  role: "owner" | "admin" | "editor" | "viewer";
  created_at: ColumnType<Date, string | undefined, never>;
}
export type WorkspaceMember = Selectable<WorkspaceMembersTable>;

export interface BasesTable {
  id: string;
  workspace_id: string;
  name: string;
  icon: string | null;
  color: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
  deleted_at: ColumnType<Date | null, string | null | undefined, string | null | undefined>;
}
export type Base = Selectable<BasesTable>;
export type NewBase = Insertable<BasesTable>;
export type BaseUpdate = Updateable<BasesTable>;

export interface TablesTable {
  id: string;
  base_id: string;
  name: string;
  description: string | null;
  pos: number;
  primary_field_id: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
  deleted_at: ColumnType<Date | null, string | null | undefined, string | null | undefined>;
}
export type TableRow = Selectable<TablesTable>;
export type NewTableRow = Insertable<TablesTable>;
export type TableRowUpdate = Updateable<TablesTable>;

export interface FieldsTable {
  id: string;
  table_id: string;
  name: string;
  type: string;
  options: ColumnType<Record<string, unknown>, string | undefined, string | undefined>;
  pos: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
  deleted_at: ColumnType<Date | null, string | null | undefined, string | null | undefined>;
}
export type FieldRow = Selectable<FieldsTable>;
export type NewFieldRow = Insertable<FieldsTable>;
export type FieldRowUpdate = Updateable<FieldsTable>;

export interface ViewsTable {
  id: string;
  table_id: string;
  name: string;
  type: string;
  config: ColumnType<Record<string, unknown>, string | undefined, string | undefined>;
  pos: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}
export type ViewRow = Selectable<ViewsTable>;
export type NewViewRow = Insertable<ViewsTable>;
export type ViewRowUpdate = Updateable<ViewsTable>;

export interface RecordsTable {
  id: string;
  table_id: string;
  data: ColumnType<Record<string, unknown>, string | undefined, string | undefined>;
  pos: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: ColumnType<Date | null, string | null | undefined, string | null | undefined>;
}
export type RecordRow = Selectable<RecordsTable>;
export type NewRecordRow = Insertable<RecordsTable>;
export type RecordRowUpdate = Updateable<RecordsTable>;

export interface InterfacesTable {
  id: string;
  base_id: string;
  name: string;
  slug: string;
  share_token: string | null;
  is_published: boolean;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}
export type InterfaceRow = Selectable<InterfacesTable>;
export type NewInterfaceRow = Insertable<InterfacesTable>;
export type InterfaceRowUpdate = Updateable<InterfacesTable>;

export interface InterfacePagesTable {
  id: string;
  interface_id: string;
  name: string;
  slug: string;
  type: string;
  config: ColumnType<Record<string, unknown>, string | undefined, string | undefined>;
  pos: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}
export type InterfacePageRow = Selectable<InterfacePagesTable>;
export type NewInterfacePageRow = Insertable<InterfacePagesTable>;
export type InterfacePageRowUpdate = Updateable<InterfacePagesTable>;

export interface ImportJobsTable {
  id: string;
  base_id: string;
  table_id: string | null;
  filename: string;
  original_name: string;
  status: string;
  mapping: ColumnType<Record<string, unknown> | null, string | null | undefined, string | null | undefined>;
  stats: ColumnType<Record<string, unknown> | null, string | null | undefined, string | null | undefined>;
  error_report_path: string | null;
  created_by: string;
  created_at: ColumnType<Date, string | undefined, never>;
  completed_at: ColumnType<Date | null, string | null | undefined, string | null | undefined>;
}
export type ImportJobRow = Selectable<ImportJobsTable>;
export type NewImportJobRow = Insertable<ImportJobsTable>;
export type ImportJobRowUpdate = Updateable<ImportJobsTable>;

export interface RefreshTokensTable {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: ColumnType<Date, string, never>;
  revoked_at: ColumnType<Date | null, string | null | undefined, string | null | undefined>;
  created_at: ColumnType<Date, string | undefined, never>;
}
export type RefreshTokenRow = Selectable<RefreshTokensTable>;
export type NewRefreshTokenRow = Insertable<RefreshTokensTable>;

export interface AttachmentsTable {
  id: string;
  base_id: string;
  field_id: string;
  record_id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  created_at: ColumnType<Date, string | undefined, never>;
}
export type AttachmentRow = Selectable<AttachmentsTable>;
export type NewAttachmentRow = Insertable<AttachmentsTable>;

export interface SchemaMigrationsTable {
  version: string;
  applied_at: ColumnType<Date, string | undefined, never>;
}
