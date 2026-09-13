import { z } from "zod";
import { fieldTypeSchema } from "./field.dto";

export const importTargetModeSchema = z.enum(["new_table", "append", "upsert"]);

export const importColumnMappingSchema = z.object({
  csvColumn: z.string(),
  action: z.enum(["createField", "mapToField", "skip"]),
  fieldId: z.string().optional(), // required when action === mapToField
  fieldName: z.string().optional(), // required when action === createField
  fieldType: fieldTypeSchema.optional(),
});
export type ImportColumnMapping = z.infer<typeof importColumnMappingSchema>;

export const executeImportSchema = z.object({
  targetMode: importTargetModeSchema,
  tableId: z.string().optional(), // required for append/upsert
  newTableName: z.string().optional(), // required for new_table
  upsertKeyFieldId: z.string().optional(), // required for upsert
  mappings: z.array(importColumnMappingSchema).min(1),
});
export type ExecuteImportDto = z.infer<typeof executeImportSchema>;

export interface ImportAnalysis {
  columns: {
    name: string;
    samples: string[];
    inferredType: z.infer<typeof fieldTypeSchema>;
    inferredOptions: Record<string, unknown>;
    confidence: number;
  }[];
  rowCount: number;
  encoding: string;
  delimiter: string;
}

export interface ImportJobStats {
  inserted: number;
  updated: number;
  failed: number;
  totalRows: number;
}

/** A job that throws before any row processing starts (a name collision,
 * a bad mapping) never has row counts to report — this is the shape
 * startExecute's catch handler persists in that case, distinct from
 * ImportJobStats. The UI must check which one it got, not assume success
 * shape and render blank fields for a message it never looked at. */
export interface ImportJobError {
  error: string;
}

export interface ImportJobStatus {
  id: string;
  status: "uploaded" | "analyzing" | "analyzed" | "running" | "completed" | "failed";
  progressPercent: number;
  stats?: ImportJobStats | ImportJobError;
  errorReportUrl?: string;
}
