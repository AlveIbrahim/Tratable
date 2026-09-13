import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiParam, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { createViewSchema, updateViewSchema } from "@tratable/shared";
import { RequireRole } from "../common/decorators/require-role.decorator";
import { ResourceParam } from "../common/decorators/resource-param.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { ViewsService } from "./views.service";

const VIEW_CONFIG_SCHEMA = {
  type: "object",
  properties: {
    fieldOrder: { type: "array", items: { type: "string" } },
    hiddenFieldIds: { type: "array", items: { type: "string" } },
    filters: { type: "object", description: "FilterNode tree — see the FilterNode type in @tratable/shared" },
    sorts: {
      type: "array",
      items: {
        type: "object",
        properties: { fieldId: { type: "string" }, direction: { type: "string", enum: ["asc", "desc"] } },
      },
    },
    rowHeight: { type: "string", enum: ["short", "medium", "tall"] },
    groupByFieldId: { type: "string" },
  },
};

@ApiTags("views")
@ApiBearerAuth("access-token")
@Controller("views")
export class ViewsController {
  constructor(private readonly views: ViewsService) {}

  @Post()
  @RequireRole("editor")
  @ResourceParam("table", "tableId", "body")
  @ApiOperation({ summary: "Create a saved view (filters/sorts/field visibility) on a table" })
  @ApiBody({
    schema: {
      type: "object",
      required: ["tableId", "name"],
      properties: {
        tableId: { type: "string" },
        name: { type: "string" },
        type: { type: "string", enum: ["grid"], default: "grid" },
        config: VIEW_CONFIG_SCHEMA,
      },
    },
  })
  create(@Body(new ZodValidationPipe(createViewSchema)) dto: any) {
    return this.views.create(dto);
  }

  @Get()
  @RequireRole("viewer")
  @ResourceParam("table", "tableId", "query")
  @ApiOperation({ summary: "List views on a table" })
  @ApiQuery({ name: "tableId" })
  list(@Query("tableId") tableId: string) {
    return this.views.listForTable(tableId);
  }

  @Patch(":viewId")
  @RequireRole("editor")
  @ResourceParam("view", "viewId")
  @ApiOperation({ summary: "Rename a view or merge-patch its config" })
  @ApiParam({ name: "viewId" })
  @ApiBody({
    schema: {
      type: "object",
      properties: { name: { type: "string" }, pos: { type: "number" }, config: VIEW_CONFIG_SCHEMA },
    },
  })
  update(@Param("viewId") viewId: string, @Body(new ZodValidationPipe(updateViewSchema)) dto: any) {
    return this.views.update(viewId, dto);
  }

  @Delete(":viewId")
  @RequireRole("editor")
  @ResourceParam("view", "viewId")
  @ApiOperation({ summary: "Delete a view" })
  @ApiParam({ name: "viewId" })
  remove(@Param("viewId") viewId: string) {
    return this.views.remove(viewId);
  }
}
