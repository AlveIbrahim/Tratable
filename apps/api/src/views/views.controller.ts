import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { createViewSchema, updateViewSchema } from "@tratable/shared";
import { RequireRole } from "../common/decorators/require-role.decorator";
import { ResourceParam } from "../common/decorators/resource-param.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { ViewsService } from "./views.service";

@Controller("views")
export class ViewsController {
  constructor(private readonly views: ViewsService) {}

  @Post()
  @RequireRole("editor")
  @ResourceParam("table", "tableId", "body")
  create(@Body(new ZodValidationPipe(createViewSchema)) dto: any) {
    return this.views.create(dto);
  }

  @Get()
  @RequireRole("viewer")
  @ResourceParam("table", "tableId", "query")
  list(@Query("tableId") tableId: string) {
    return this.views.listForTable(tableId);
  }

  @Patch(":viewId")
  @RequireRole("editor")
  @ResourceParam("view", "viewId")
  update(@Param("viewId") viewId: string, @Body(new ZodValidationPipe(updateViewSchema)) dto: any) {
    return this.views.update(viewId, dto);
  }

  @Delete(":viewId")
  @RequireRole("editor")
  @ResourceParam("view", "viewId")
  remove(@Param("viewId") viewId: string) {
    return this.views.remove(viewId);
  }
}
