import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiParam, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import {
  bulkCreateRecordsSchema,
  bulkUpdateRecordsSchema,
  createRecordSchema,
  listRecordsQuerySchema,
  updateRecordSchema,
} from "@tratable/shared";
import { CurrentUser, RequestUser } from "../common/decorators/current-user.decorator";
import { RequireRole } from "../common/decorators/require-role.decorator";
import { ResourceParam } from "../common/decorators/resource-param.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { RecordsService } from "./records.service";

const RECORD_DATA_BODY = {
  type: "object",
  required: ["data"],
  properties: {
    data: { type: "object", description: "Field id -> value, e.g. { \"fld_abc123\": \"Acme Inc\" }" },
  },
};

@ApiTags("records")
@ApiBearerAuth("access-token")
@Controller()
export class RecordsController {
  constructor(private readonly records: RecordsService) {}

  @Get("tables/:tableId/records")
  @RequireRole("viewer")
  @ResourceParam("table", "tableId")
  @ApiOperation({
    summary: "List records in a table",
    description:
      "Keyset-paginated (never OFFSET). Pass the previous page's nextCursor to continue. " +
      "filters/sorts are JSON-encoded query params: filters is a FilterNode tree, sorts is [{fieldId, direction}].",
  })
  @ApiParam({ name: "tableId" })
  @ApiQuery({ name: "viewId", required: false })
  @ApiQuery({ name: "filters", required: false, description: "JSON-encoded FilterNode tree" })
  @ApiQuery({ name: "sorts", required: false, description: "JSON-encoded [{fieldId, direction}]" })
  @ApiQuery({ name: "cursor", required: false })
  @ApiQuery({ name: "limit", required: false, schema: { type: "integer", minimum: 1, maximum: 500, default: 100 } })
  list(@Param("tableId") tableId: string, @Query(new ZodValidationPipe(listRecordsQuerySchema)) query: any) {
    return this.records.list(tableId, query);
  }

  @Post("tables/:tableId/records")
  @RequireRole("editor")
  @ResourceParam("table", "tableId")
  @ApiOperation({ summary: "Create a record" })
  @ApiParam({ name: "tableId" })
  @ApiBody({ schema: RECORD_DATA_BODY })
  create(
    @Param("tableId") tableId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createRecordSchema)) dto: any,
  ) {
    return this.records.create(tableId, user.id, dto);
  }

  @Post("tables/:tableId/records/bulk")
  @RequireRole("editor")
  @ResourceParam("table", "tableId")
  @ApiOperation({ summary: "Create up to 1000 records in one request" })
  @ApiParam({ name: "tableId" })
  @ApiBody({
    schema: {
      type: "object",
      required: ["records"],
      properties: { records: { type: "array", items: RECORD_DATA_BODY, minItems: 1, maxItems: 1000 } },
    },
  })
  bulkCreate(
    @Param("tableId") tableId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(bulkCreateRecordsSchema)) dto: any,
  ) {
    return this.records.bulkCreate(tableId, user.id, dto);
  }

  @Patch("tables/:tableId/records/bulk")
  @RequireRole("editor")
  @ResourceParam("table", "tableId")
  @ApiOperation({
    summary: "Update up to 1000 records in one request",
    description: "Every record id must belong to :tableId — a mismatched id is rejected with 400.",
  })
  @ApiParam({ name: "tableId" })
  @ApiBody({
    schema: {
      type: "object",
      required: ["records"],
      properties: {
        records: {
          type: "array",
          minItems: 1,
          maxItems: 1000,
          items: {
            type: "object",
            required: ["id", "data"],
            properties: { id: { type: "string" }, data: { type: "object" } },
          },
        },
      },
    },
  })
  bulkUpdate(
    @Param("tableId") tableId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(bulkUpdateRecordsSchema)) dto: any,
  ) {
    return this.records.bulkUpdate(tableId, user.id, dto);
  }

  @Get("records/:recordId")
  @RequireRole("viewer")
  @ResourceParam("record", "recordId")
  @ApiOperation({ summary: "Get a record by id" })
  @ApiParam({ name: "recordId" })
  get(@Param("recordId") recordId: string) {
    return this.records.getOrThrow(recordId);
  }

  @Patch("records/:recordId")
  @RequireRole("editor")
  @ResourceParam("record", "recordId")
  @ApiOperation({ summary: "Update a record (merge-patches the given fields into its data)" })
  @ApiParam({ name: "recordId" })
  @ApiBody({ schema: RECORD_DATA_BODY })
  update(
    @Param("recordId") recordId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(updateRecordSchema)) dto: any,
  ) {
    return this.records.update(recordId, user.id, dto);
  }

  @Delete("records/:recordId")
  @RequireRole("editor")
  @ResourceParam("record", "recordId")
  @ApiOperation({ summary: "Soft-delete a record" })
  @ApiParam({ name: "recordId" })
  remove(@Param("recordId") recordId: string) {
    return this.records.softDelete(recordId);
  }
}
