import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { createBaseSchema, updateBaseSchema } from "@tratable/shared";
import { RequireRole } from "../common/decorators/require-role.decorator";
import { ResourceParam } from "../common/decorators/resource-param.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { BasesService } from "./bases.service";

@Controller("bases")
export class BasesController {
  constructor(private readonly bases: BasesService) {}

  @Post()
  @RequireRole("editor")
  @ResourceParam("workspace", "workspaceId", "body")
  create(@Body(new ZodValidationPipe(createBaseSchema)) dto: any) {
    return this.bases.create(dto);
  }

  @Get()
  @RequireRole("viewer")
  @ResourceParam("workspace", "workspaceId", "query")
  list(@Query("workspaceId") workspaceId: string) {
    return this.bases.listForWorkspace(workspaceId);
  }

  @Get(":baseId")
  @RequireRole("viewer")
  @ResourceParam("base", "baseId")
  get(@Param("baseId") baseId: string) {
    return this.bases.getOrThrow(baseId);
  }

  @Patch(":baseId")
  @RequireRole("editor")
  @ResourceParam("base", "baseId")
  update(@Param("baseId") baseId: string, @Body(new ZodValidationPipe(updateBaseSchema)) dto: any) {
    return this.bases.update(baseId, dto);
  }

  @Delete(":baseId")
  @RequireRole("admin")
  @ResourceParam("base", "baseId")
  remove(@Param("baseId") baseId: string) {
    return this.bases.softDelete(baseId);
  }
}
