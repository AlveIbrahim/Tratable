import { z } from "zod";
import { filterNodeSchema, sortSpecSchema } from "../query/filter";

export const createRecordSchema = z.object({
  data: z.record(z.string(), z.unknown()),
});
export type CreateRecordDto = z.infer<typeof createRecordSchema>;

export const bulkCreateRecordsSchema = z.object({
  records: z.array(createRecordSchema).min(1).max(1000),
});
export type BulkCreateRecordsDto = z.infer<typeof bulkCreateRecordsSchema>;

export const updateRecordSchema = z.object({
  data: z.record(z.string(), z.unknown()),
});
export type UpdateRecordDto = z.infer<typeof updateRecordSchema>;

export const bulkUpdateRecordsSchema = z.object({
  records: z.array(z.object({ id: z.string(), data: z.record(z.string(), z.unknown()) })).min(1).max(1000),
});
export type BulkUpdateRecordsDto = z.infer<typeof bulkUpdateRecordsSchema>;

/** filters/sorts arrive over the wire as JSON-encoded query-string values
 * (GET requests can't carry a JSON body) — preprocess parses that string
 * before the shape schema underneath validates it. A GUI client may also
 * pass them as already-parsed objects (e.g. server-side rendering), so a
 * non-string value is passed through unchanged. */
function jsonQueryParam<T extends z.ZodType>(schema: T) {
  return z.preprocess((val) => {
    if (typeof val !== "string" || val === "") return val;
    try {
      return JSON.parse(val);
    } catch {
      return val; // let the underlying schema produce a proper validation error
    }
  }, schema);
}

export const listRecordsQuerySchema = z.object({
  viewId: z.string().optional(),
  filters: jsonQueryParam(filterNodeSchema).optional(),
  sorts: jsonQueryParam(z.array(sortSpecSchema)).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});
export type ListRecordsQueryDto = z.infer<typeof listRecordsQuerySchema>;

export interface RecordDto {
  id: string;
  tableId: string;
  data: Record<string, unknown>;
  pos: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedRecords {
  records: RecordDto[];
  nextCursor: string | null;
}
