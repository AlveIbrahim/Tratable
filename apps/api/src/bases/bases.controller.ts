import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiParam, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { createBaseSchema, updateBaseSchema } from "@tratable/shared";
import { RequireRole } from "../common/decorators/require-role.decorator";
import { ResourceParam } from "../common/decorators/resource-param.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { ExportService } from "../export/export.service";
import { BasesService } from "./bases.service";

@ApiTags("bases")
@ApiBearerAuth("access-token")
@Controller("bases")
export class BasesController {
  constructor(
    private readonly bases: BasesService,
    private readonly exportService: ExportService,
  ) {}

  @Post()
  @RequireRole("editor")
  @ResourceParam("workspace", "workspaceId", "body")
  @ApiOperation({ summary: "Create a base within a workspace (requires editor role on that workspace)" })
  @ApiBody({
    schema: {
      type: "object",
      required: ["workspaceId", "name"],
      properties: {
        workspaceId: { type: "string" },
        name: { type: "string" },
        icon: { type: "string", maxLength: 8 },
        color: { type: "string", maxLength: 20 },
      },
    },
  })
  create(@Body(new ZodValidationPipe(createBaseSchema)) dto: any) {
    return this.bases.create(dto);
  }

  @Get()
  @RequireRole("viewer")
  @ResourceParam("workspace", "workspaceId", "query")
  @ApiOperation({ summary: "List bases in a workspace" })
  @ApiQuery({ name: "workspaceId" })
  list(@Query("workspaceId") workspaceId: string) {
    return this.bases.listForWorkspace(workspaceId);
  }

  @Get(":baseId")
  @RequireRole("viewer")
  @ResourceParam("base", "baseId")
  @ApiOperation({ summary: "Get a base by id" })
  @ApiParam({ name: "baseId" })
  get(@Param("baseId") baseId: string) {
    return this.bases.getOrThrow(baseId);
  }

  @Patch(":baseId")
  @RequireRole("editor")
  @ResourceParam("base", "baseId")
  @ApiOperation({ summary: "Update a base's name, icon, or color" })
  @ApiParam({ name: "baseId" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        icon: { type: "string", maxLength: 8 },
        color: { type: "string", maxLength: 20 },
      },
    },
  })
  update(@Param("baseId") baseId: string, @Body(new ZodValidationPipe(updateBaseSchema)) dto: any) {
    return this.bases.update(baseId, dto);
  }

  @Delete(":baseId")
  @RequireRole("admin")
  @ResourceParam("base", "baseId")
  @ApiOperation({ summary: "Soft-delete a base (requires admin role)" })
  @ApiParam({ name: "baseId" })
  remove(@Param("baseId") baseId: string) {
    return this.bases.softDelete(baseId);
  }

  @Get(":baseId/export")
  @RequireRole("viewer")
  @ResourceParam("base", "baseId")
  @ApiOperation({ summary: "Stream a zip containing one unfiltered CSV per table in the base" })
  @ApiParam({ name: "baseId" })
  async export(@Param("baseId") baseId: string, @Res() res: Response) {
    const { stream, baseName } = await this.exportService.streamBaseZip(baseId);
    const safeName = baseName.replace(/[/\\?%*:|"<>]/g, "_");
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}.zip"`);
    stream.pipe(res);
  }
}
