import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
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

@Controller()
export class RecordsController {
  constructor(private readonly records: RecordsService) {}

  @Get("tables/:tableId/records")
  @RequireRole("viewer")
  @ResourceParam("table", "tableId")
  list(@Param("tableId") tableId: string, @Query(new ZodValidationPipe(listRecordsQuerySchema)) query: any) {
    return this.records.list(tableId, query);
  }

  @Post("tables/:tableId/records")
  @RequireRole("editor")
  @ResourceParam("table", "tableId")
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
  get(@Param("recordId") recordId: string) {
    return this.records.getOrThrow(recordId);
  }

  @Patch("records/:recordId")
  @RequireRole("editor")
  @ResourceParam("record", "recordId")
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
  remove(@Param("recordId") recordId: string) {
    return this.records.softDelete(recordId);
  }
}
