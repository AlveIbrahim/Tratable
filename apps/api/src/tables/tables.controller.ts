import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiParam, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { createTableSchema, updateTableSchema } from "@tratable/shared";
import { RequireRole } from "../common/decorators/require-role.decorator";
import { ResourceParam } from "../common/decorators/resource-param.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { TablesService } from "./tables.service";

@ApiTags("tables")
@ApiBearerAuth("access-token")
@Controller("tables")
export class TablesController {
  constructor(private readonly tables: TablesService) {}

  @Post()
  @RequireRole("editor")
  @ResourceParam("base", "baseId", "body")
  @ApiOperation({ summary: "Create a table (also creates a default 'Name' field and a Grid view)" })
  @ApiBody({
    schema: {
      type: "object",
      required: ["baseId", "name"],
      properties: {
        baseId: { type: "string" },
        name: { type: "string" },
        description: { type: "string", maxLength: 2000 },
      },
    },
  })
  create(@Body(new ZodValidationPipe(createTableSchema)) dto: any) {
    return this.tables.create(dto);
  }

  @Get()
  @RequireRole("viewer")
  @ResourceParam("base", "baseId", "query")
  @ApiOperation({ summary: "List tables in a base" })
  @ApiQuery({ name: "baseId" })
  list(@Query("baseId") baseId: string) {
    return this.tables.listForBase(baseId);
  }

  @Get(":tableId")
  @RequireRole("viewer")
  @ResourceParam("table", "tableId")
  @ApiOperation({ summary: "Get a table by id" })
  @ApiParam({ name: "tableId" })
  get(@Param("tableId") tableId: string) {
    return this.tables.getOrThrow(tableId);
  }

  @Patch(":tableId")
  @RequireRole("editor")
  @ResourceParam("table", "tableId")
  @ApiOperation({ summary: "Update a table's name, description, position, or primary field" })
  @ApiParam({ name: "tableId" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        pos: { type: "number" },
        primaryFieldId: { type: "string" },
      },
    },
  })
  update(@Param("tableId") tableId: string, @Body(new ZodValidationPipe(updateTableSchema)) dto: any) {
    return this.tables.update(tableId, dto);
  }

  @Delete(":tableId")
  @RequireRole("admin")
  @ResourceParam("table", "tableId")
  @ApiOperation({ summary: "Soft-delete a table and everything in it (requires admin role)" })
  @ApiParam({ name: "tableId" })
  remove(@Param("tableId") tableId: string) {
    return this.tables.softDelete(tableId);
  }
}
