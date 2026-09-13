import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { createTableSchema, updateTableSchema } from "@tratable/shared";
import { RequireRole } from "../common/decorators/require-role.decorator";
import { ResourceParam } from "../common/decorators/resource-param.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { TablesService } from "./tables.service";

@Controller("tables")
export class TablesController {
  constructor(private readonly tables: TablesService) {}

  @Post()
  @RequireRole("editor")
  @ResourceParam("base", "baseId", "body")
  create(@Body(new ZodValidationPipe(createTableSchema)) dto: any) {
    return this.tables.create(dto);
  }

  @Get()
  @RequireRole("viewer")
  @ResourceParam("base", "baseId", "query")
  list(@Query("baseId") baseId: string) {
    return this.tables.listForBase(baseId);
  }

  @Get(":tableId")
  @RequireRole("viewer")
  @ResourceParam("table", "tableId")
  get(@Param("tableId") tableId: string) {
    return this.tables.getOrThrow(tableId);
  }

  @Patch(":tableId")
  @RequireRole("editor")
  @ResourceParam("table", "tableId")
  update(@Param("tableId") tableId: string, @Body(new ZodValidationPipe(updateTableSchema)) dto: any) {
    return this.tables.update(tableId, dto);
  }

  @Delete(":tableId")
  @RequireRole("admin")
  @ResourceParam("table", "tableId")
  remove(@Param("tableId") tableId: string) {
    return this.tables.softDelete(tableId);
  }
}
