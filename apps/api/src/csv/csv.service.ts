import * as fs from "node:fs";
import * as path from "node:path";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { parse } from "csv-parse";
import { stringify } from "csv-stringify/sync";
import {
  ExecuteImportDto,
  FieldType,
  getFieldType,
  ImportAnalysis,
  ImportColumnMapping,
  ImportJobStatus,
  inferColumnType,
  makeId,
} from "@tratable/shared";
import { DatabaseService } from "../database/database.service";
import { FieldRow } from "../database/schema";
import { sniffFile } from "./csv-sniff";

const ANALYZE_SAMPLE_ROWS = 500;
const BATCH_SIZE = 1000;
const POS_STEP = 65536;

/** Field types a CSV column may be mapped or created as. Computed/derived
 * types (autoNumber, createdTime, lastModifiedTime) are server-assigned and
 * can't receive imported values; attachment has no meaningful bare-CSV
 * representation (no file bytes to attach) — see attachment.ts's
 * parseFromCsv, which always rejects. linkToRecord needs a linked-table
 * label index built before row processing, so it's only allowed via
 * mapToField against an existing link field, never createField from CSV. */
const IMPORTABLE_CREATE_TYPES: FieldType[] = [
  "singleLineText", "longText", "number", "checkbox", "singleSelect",
  "multiSelect", "date", "dateTime", "email", "url", "phone",
];
const UNSUPPORTED_TARGET_TYPES: FieldType[] = ["attachment", "autoNumber", "createdTime", "lastModifiedTime"];

interface RowError {
  row: number;
  column: string;
  rawValue: string;
  reason: string;
}

@Injectable()
export class CsvService {
  private readonly uploadsDir: string;
  private readonly maxFileBytes: number;
  private readonly maxRows: number;

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
  ) {
    this.uploadsDir = path.resolve(config.get<string>("UPLOADS_DIR", "./uploads"), "imports");
    fs.mkdirSync(this.uploadsDir, { recursive: true });
    this.maxFileBytes = Number(config.get<string>("IMPORT_MAX_FILE_MB", "50")) * 1024 * 1024;
    this.maxRows = Number(config.get<string>("IMPORT_MAX_ROWS", "500000"));
  }

  get multerDestination() {
    return this.uploadsDir;
  }
  get maxFileSizeBytes() {
    return this.maxFileBytes;
  }

  async createJob(baseId: string, userId: string, file: Express.Multer.File) {
    const id = makeId("importJob");
    await this.db.db
      .insertInto("import_jobs")
      .values({
        id,
        base_id: baseId,
        filename: file.filename,
        original_name: file.originalname,
        status: "uploaded",
        created_by: userId,
      })
      .execute();
    return { id, filename: file.filename, originalName: file.originalname };
  }

  private async getJobOrThrow(id: string) {
    const job = await this.db.db.selectFrom("import_jobs").selectAll().where("id", "=", id).executeTakeFirst();
    if (!job) throw new NotFoundException("Import job not found");
    return job;
  }

  private filePath(filename: string): string {
    return path.join(this.uploadsDir, filename);
  }

  /** Reads the header plus up to ANALYZE_SAMPLE_ROWS sample rows and infers
   * a type per column. Stateless and re-computable from the stored file —
   * nothing here is persisted, so calling it twice is safe and cheap. */
  async analyze(jobId: string): Promise<ImportAnalysis> {
    const job = await this.getJobOrThrow(jobId);
    const filePath = this.filePath(job.filename);
    if (!fs.existsSync(filePath)) throw new NotFoundException("Uploaded file is no longer available");

    const { encoding, delimiter } = sniffFile(filePath);

    const rows: string[][] = [];
    let rowCount = 0;
    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(filePath, { encoding: encoding as BufferEncoding })
        .pipe(parse({ delimiter, relax_column_count: true, skip_empty_lines: true }))
        .on("data", (row: string[]) => {
          if (rowCount === 0 || rows.length <= ANALYZE_SAMPLE_ROWS) rows.push(row);
          rowCount++;
        })
        .on("end", resolve)
        .on("error", reject);
    });

    if (rows.length === 0) throw new BadRequestException("CSV file has no rows");
    const [header, ...sampleRows] = rows;
    const dataRowCount = Math.max(rowCount - 1, 0);

    if (dataRowCount > this.maxRows) {
      throw new BadRequestException(
        `File has ${dataRowCount} rows, which exceeds the ${this.maxRows}-row import limit`,
      );
    }

    const columns = header.map((name, colIdx) => {
      const samples = sampleRows.map((r) => r[colIdx] ?? "").filter((s) => s !== "");
      const inferred = inferColumnType(samples);
      return {
        name: name || `Column ${colIdx + 1}`,
        samples: samples.slice(0, 10),
        inferredType: inferred.type,
        inferredOptions: inferred.options,
        confidence: inferred.confidence,
      };
    });

    await this.db.db
      .updateTable("import_jobs")
      .set({ status: "analyzed" })
      .where("id", "=", jobId)
      .execute();

    return { columns, rowCount: dataRowCount, encoding, delimiter };
  }

  async getStatus(jobId: string): Promise<ImportJobStatus> {
    const job = await this.getJobOrThrow(jobId);
    const stats = job.stats as ImportJobStatus["stats"] | null;
    // `failed` counts cell-level parse errors, not skipped rows — every row
    // is still inserted or updated even when one of its cells failed to
    // parse (the bad cell is just left empty). Row-completion progress is
    // therefore inserted+updated alone; `failed` is reported separately as
    // an informational count and must not be added into this denominator.
    const rowsProcessed = stats ? stats.inserted + stats.updated : 0;
    const progressPercent = stats && stats.totalRows > 0
      ? Math.min(100, Math.round((rowsProcessed / stats.totalRows) * 100))
      : job.status === "completed"
        ? 100
        : 0;
    return {
      id: job.id,
      status: job.status as ImportJobStatus["status"],
      progressPercent,
      stats: stats ?? undefined,
      errorReportUrl: job.error_report_path ? `/api/imports/${job.id}/error-report` : undefined,
    };
  }

  async getErrorReportPath(jobId: string): Promise<string> {
    const job = await this.getJobOrThrow(jobId);
    if (!job.error_report_path || !fs.existsSync(job.error_report_path)) {
      throw new NotFoundException("No error report available for this job");
    }
    return job.error_report_path;
  }

  /**
   * Kicks off the import and returns immediately with status 'running' —
   * the actual row processing happens after the response is sent (see
   * CsvController). The client polls getStatus() for progress.
   */
  async startExecute(jobId: string, dto: ExecuteImportDto): Promise<void> {
    const job = await this.getJobOrThrow(jobId);
    this.validateMappings(dto);

    await this.db.db
      .updateTable("import_jobs")
      .set({ status: "running", mapping: JSON.stringify(dto), table_id: dto.tableId ?? null })
      .where("id", "=", jobId)
      .execute();

    // Deliberately not awaited by the caller — see startExecute's doc comment.
    this.runImport(job.id, job.base_id, this.filePath(job.filename), dto).catch(async (err) => {
      await this.db.db
        .updateTable("import_jobs")
        .set({ status: "failed", stats: JSON.stringify({ error: String(err?.message ?? err) }) })
        .where("id", "=", jobId)
        .execute();
    });
  }

  private validateMappings(dto: ExecuteImportDto) {
    if (dto.targetMode !== "new_table" && !dto.tableId) {
      throw new BadRequestException("tableId is required for append/upsert");
    }
    if (dto.targetMode === "new_table" && !dto.newTableName?.trim()) {
      throw new BadRequestException("newTableName is required when creating a new table");
    }
    if (dto.targetMode === "upsert" && !dto.upsertKeyFieldId) {
      throw new BadRequestException("upsertKeyFieldId is required for upsert");
    }
    for (const m of dto.mappings) {
      if (m.action === "createField" && (!m.fieldName?.trim() || !m.fieldType)) {
        throw new BadRequestException(`Column "${m.csvColumn}": fieldName and fieldType are required to create a field`);
      }
      if (m.action === "createField" && !IMPORTABLE_CREATE_TYPES.includes(m.fieldType!)) {
        throw new BadRequestException(`Column "${m.csvColumn}": cannot create a field of type "${m.fieldType}" from CSV`);
      }
      if (m.action === "mapToField" && !m.fieldId) {
        throw new BadRequestException(`Column "${m.csvColumn}": fieldId is required to map to an existing field`);
      }
    }
  }

  private async runImport(jobId: string, baseId: string, filePath: string, dto: ExecuteImportDto) {
    const { encoding, delimiter } = sniffFile(filePath);

    // Resolve/create the target table and every mapped field up front —
    // one small metadata transaction, before touching any row data.
    let tableId: string;
    if (dto.targetMode === "new_table") {
      tableId = await this.createTableFromMappings(baseId, dto.newTableName!.trim(), dto.mappings);
    } else {
      tableId = dto.tableId!;
      await this.createMissingFields(tableId, dto.mappings);
    }

    const fields = await this.db.db
      .selectFrom("fields")
      .selectAll()
      .where("table_id", "=", tableId)
      .where("deleted_at", "is", null)
      .execute();
    const fieldById = new Map(fields.map((f) => [f.id, f]));

    // csvColumn -> resolved field, in header order. "skip" columns are
    // dropped entirely; every other column now points at a real field id.
    const columnFields = await this.resolveColumnFields(tableId, dto.mappings, fieldById);

    // Upsert needs the whole table's current key values in memory once,
    // rather than a query per row.
    let upsertIndex: Map<string, string> | null = null; // key value (JSON) -> record id
    if (dto.targetMode === "upsert") {
      upsertIndex = await this.buildUpsertIndex(tableId, dto.upsertKeyFieldId!);
    }

    // Choice caches so repeated "__new__:Label" sentinels within one import
    // resolve to the same choice id instead of minting a duplicate per row.
    const choiceCaches = new Map<string, Map<string, string>>();
    for (const field of fields) {
      if (field.type === "singleSelect" || field.type === "multiSelect") {
        const choices = (field.options as any).choices ?? [];
        choiceCaches.set(field.id, new Map(choices.map((c: any) => [c.name.toLowerCase(), c.id])));
      }
    }

    const rowErrors: RowError[] = [];
    let inserted = 0;
    let updated = 0;
    let failedRows = 0;
    let rowIndex = 0;
    let header: string[] = [];
    let batch: { data: Record<string, unknown>; upsertMatch?: string }[] = [];
    let totalRows = 0;

    // First pass just to get an accurate total for progress reporting —
    // cheap relative to the parse+insert pass, and avoids a wrong percentage
    // on the first status poll.
    totalRows = await this.countDataRows(filePath, encoding, delimiter);
    await this.updateStats(jobId, { inserted: 0, updated: 0, failed: 0, totalRows });

    await new Promise<void>((resolve, reject) => {
      const stream = fs
        .createReadStream(filePath, { encoding: encoding as BufferEncoding })
        .pipe(parse({ delimiter, relax_column_count: true, skip_empty_lines: true }));

      stream.on("data", (row: string[]) => {
        if (rowIndex === 0) {
          header = row;
          rowIndex++;
          return;
        }
        const dataRowNum = rowIndex; // 1-based data row (header is row 0)
        const record: Record<string, unknown> = {};

        for (const [colIdx, colName] of header.entries()) {
          const cf = columnFields.get(colName);
          if (!cf) continue;
          const raw = row[colIdx] ?? "";
          if (raw === "") continue;

          const def = getFieldType(cf.type as FieldType);
          const parsed = def.parseFromCsv(raw, cf.options as any, {});
          if (!parsed.ok) {
            rowErrors.push({ row: dataRowNum, column: colName, rawValue: raw, reason: parsed.error });
            continue;
          }
          record[cf.id] = this.resolveNewChoices(cf, parsed.value, choiceCaches);
        }

        let upsertMatch: string | undefined;
        if (upsertIndex && dto.upsertKeyFieldId) {
          const keyValue = record[dto.upsertKeyFieldId];
          if (keyValue !== undefined) {
            upsertMatch = upsertIndex.get(JSON.stringify(keyValue));
          }
        }

        batch.push({ data: record, upsertMatch });
        rowIndex++;

        if (batch.length >= BATCH_SIZE) {
          stream.pause();
          this.flushBatch(tableId, batch, upsertIndex, dto.upsertKeyFieldId)
            .then((result) => {
              inserted += result.inserted;
              updated += result.updated;
              batch = [];
              return this.updateStats(jobId, {
                inserted,
                updated,
                failed: rowErrors.length,
                totalRows,
              });
            })
            .then(() => stream.resume())
            .catch(reject);
        }
      });

      stream.on("end", async () => {
        try {
          if (batch.length > 0) {
            const result = await this.flushBatch(tableId, batch, upsertIndex, dto.upsertKeyFieldId);
            inserted += result.inserted;
            updated += result.updated;
          }
          resolve();
        } catch (e) {
          reject(e);
        }
      });
      stream.on("error", reject);
    });

    let errorReportPath: string | null = null;
    if (rowErrors.length > 0) {
      errorReportPath = await this.writeErrorReport(jobId, rowErrors);
    }

    await this.db.db
      .updateTable("import_jobs")
      .set({
        status: "completed",
        table_id: tableId,
        stats: JSON.stringify({ inserted, updated, failed: rowErrors.length, totalRows }),
        error_report_path: errorReportPath,
        completed_at: new Date().toISOString(),
      })
      .where("id", "=", jobId)
      .execute();
  }

  private resolveNewChoices(field: FieldRow, value: unknown, caches: Map<string, Map<string, string>>): unknown {
    if (field.type !== "singleSelect" && field.type !== "multiSelect") return value;
    const cache = caches.get(field.id) ?? new Map<string, string>();
    caches.set(field.id, cache);

    const resolveOne = (v: string): string => {
      if (!v.startsWith("__new__:")) return v;
      const label = v.slice("__new__:".length);
      const existing = cache.get(label.toLowerCase());
      if (existing) return existing;
      const id = makeId("option");
      cache.set(label.toLowerCase(), id);
      // Persist the new choice onto the field's options immediately so a
      // concurrent reader (or a crash mid-import) sees a consistent field
      // definition rather than orphan choice ids in record data.
      void this.appendChoice(field.id, id, label);
      return id;
    };

    if (field.type === "singleSelect") return resolveOne(value as string);
    return (value as string[]).map(resolveOne);
  }

  private pendingChoiceWrites = new Map<string, Promise<void>>();
  private async appendChoice(fieldId: string, choiceId: string, name: string) {
    // Serialize writes per field so concurrent new-choice appends within the
    // same import don't race and clobber each other's jsonb_set.
    const prior = this.pendingChoiceWrites.get(fieldId) ?? Promise.resolve();
    const next = prior.then(async () => {
      const field = await this.db.db.selectFrom("fields").select("options").where("id", "=", fieldId).executeTakeFirst();
      const choices = ((field?.options as any)?.choices ?? []) as { id: string; name: string }[];
      if (choices.some((c) => c.id === choiceId)) return;
      choices.push({ id: choiceId, name });
      await this.db.db
        .updateTable("fields")
        .set({ options: JSON.stringify({ ...(field?.options as any), choices }) })
        .where("id", "=", fieldId)
        .execute();
    });
    this.pendingChoiceWrites.set(fieldId, next);
    await next;
  }

  private async createTableFromMappings(baseId: string, name: string, mappings: ImportColumnMapping[]): Promise<string> {
    return this.db.runInTransaction(async () => {
      const tableId = makeId("table");
      const max = await this.db.db
        .selectFrom("tables")
        .select(({ fn }) => fn.max("pos").as("maxPos"))
        .where("base_id", "=", baseId)
        .where("deleted_at", "is", null)
        .executeTakeFirst();
      const pos = (Number(max?.maxPos) || 0) + POS_STEP;
      await this.db.db.insertInto("tables").values({ id: tableId, base_id: baseId, name, pos }).execute();

      let fieldPos = 0;
      let firstFieldId: string | null = null;
      for (const m of mappings) {
        if (m.action !== "createField") continue;
        fieldPos += POS_STEP;
        const fieldId = makeId("field");
        const def = getFieldType(m.fieldType!);
        await this.db.db
          .insertInto("fields")
          .values({
            id: fieldId,
            table_id: tableId,
            name: m.fieldName!.trim(),
            type: m.fieldType!,
            options: JSON.stringify(def.defaultOptions),
            pos: fieldPos,
          })
          .execute();
        firstFieldId ??= fieldId;
      }
      if (!firstFieldId) throw new BadRequestException("At least one column must be imported as a field");

      await this.db.db.updateTable("tables").set({ primary_field_id: firstFieldId }).where("id", "=", tableId).execute();
      await this.db.db
        .insertInto("views")
        .values({ id: makeId("view"), table_id: tableId, name: "Grid view", type: "grid", pos: POS_STEP })
        .execute();

      return tableId;
    });
  }

  private async createMissingFields(tableId: string, mappings: ImportColumnMapping[]) {
    const existing = await this.db.db.selectFrom("fields").select("id").where("table_id", "=", tableId).where("deleted_at", "is", null).execute();
    const max = await this.db.db
      .selectFrom("fields")
      .select(({ fn }) => fn.max("pos").as("maxPos"))
      .where("table_id", "=", tableId)
      .executeTakeFirst();
    let pos = Number(max?.maxPos) || 0;

    for (const m of mappings) {
      if (m.action !== "createField") continue;
      pos += POS_STEP;
      const def = getFieldType(m.fieldType!);
      await this.db.db
        .insertInto("fields")
        .values({
          id: makeId("field"),
          table_id: tableId,
          name: m.fieldName!.trim(),
          type: m.fieldType!,
          options: JSON.stringify(def.defaultOptions),
          pos,
        })
        .execute();
    }
  }

  /** Maps each non-skipped CSV column name to the field row it now targets,
   * resolving "createField" columns to the field just created for them. */
  private async resolveColumnFields(
    tableId: string,
    mappings: ImportColumnMapping[],
    fieldById: Map<string, FieldRow>,
  ): Promise<Map<string, FieldRow>> {
    const byName = new Map<string, FieldRow>();
    const allFields = [...fieldById.values()];
    for (const m of mappings) {
      if (m.action === "skip") continue;
      if (m.action === "mapToField") {
        const field = fieldById.get(m.fieldId!);
        if (!field) throw new BadRequestException(`Field ${m.fieldId} not found on target table`);
        if (UNSUPPORTED_TARGET_TYPES.includes(field.type as FieldType)) {
          throw new BadRequestException(`Column "${m.csvColumn}": field "${field.name}" cannot receive imported values`);
        }
        byName.set(m.csvColumn, field);
      } else {
        const field = allFields.find((f) => f.name === m.fieldName!.trim() && f.table_id === tableId);
        if (!field) throw new BadRequestException(`Created field "${m.fieldName}" could not be resolved`);
        byName.set(m.csvColumn, field);
      }
    }
    return byName;
  }

  private async buildUpsertIndex(tableId: string, keyFieldId: string): Promise<Map<string, string>> {
    const rows = await this.db.db
      .selectFrom("records")
      .select(["id", "data"])
      .where("table_id", "=", tableId)
      .where("deleted_at", "is", null)
      .execute();
    const index = new Map<string, string>();
    for (const row of rows) {
      const keyValue = (row.data as Record<string, unknown>)[keyFieldId];
      if (keyValue !== undefined) index.set(JSON.stringify(keyValue), row.id);
    }
    return index;
  }

  private async flushBatch(
    tableId: string,
    batch: { data: Record<string, unknown>; upsertMatch?: string }[],
    upsertIndex: Map<string, string> | null,
    upsertKeyFieldId: string | undefined,
  ): Promise<{ inserted: number; updated: number }> {
    let inserted = 0;
    let updated = 0;

    await this.db.runInTransaction(async () => {
      const max = await this.db.db
        .selectFrom("records")
        .select(({ fn }) => fn.max("pos").as("maxPos"))
        .where("table_id", "=", tableId)
        .where("deleted_at", "is", null)
        .executeTakeFirst();
      let pos = Number(max?.maxPos) || 0;

      for (const item of batch) {
        if (item.upsertMatch) {
          const existing = await this.db.db.selectFrom("records").select("data").where("id", "=", item.upsertMatch).executeTakeFirst();
          const merged = { ...(existing?.data as object), ...item.data };
          await this.db.db
            .updateTable("records")
            .set({ data: JSON.stringify(merged), updated_at: new Date().toISOString() })
            .where("id", "=", item.upsertMatch)
            .execute();
          updated++;
        } else {
          pos += POS_STEP;
          const id = makeId("record");
          await this.db.db.insertInto("records").values({ id, table_id: tableId, data: JSON.stringify(item.data), pos }).execute();
          inserted++;
          if (upsertIndex && upsertKeyFieldId && item.data[upsertKeyFieldId] !== undefined) {
            upsertIndex.set(JSON.stringify(item.data[upsertKeyFieldId]), id);
          }
        }
      }
    });

    return { inserted, updated };
  }

  private async countDataRows(filePath: string, encoding: string, delimiter: string): Promise<number> {
    let count = 0;
    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(filePath, { encoding: encoding as BufferEncoding })
        .pipe(parse({ delimiter, relax_column_count: true, skip_empty_lines: true }))
        .on("data", () => count++)
        .on("end", resolve)
        .on("error", reject);
    });
    return Math.max(count - 1, 0); // exclude header
  }

  private async updateStats(jobId: string, stats: { inserted: number; updated: number; failed: number; totalRows: number }) {
    await this.db.db.updateTable("import_jobs").set({ stats: JSON.stringify(stats) }).where("id", "=", jobId).execute();
  }

  private async writeErrorReport(jobId: string, errors: RowError[]): Promise<string> {
    const csv = stringify(errors, { header: true, columns: ["row", "column", "rawValue", "reason"] });
    const filePath = path.join(this.uploadsDir, `${jobId}-errors.csv`);
    fs.writeFileSync(filePath, csv);
    return filePath;
  }
}
