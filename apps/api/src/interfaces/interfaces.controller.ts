import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { createInterfaceSchema } from "@tratable/shared";
import { z } from "zod";
import { RequireRole } from "../common/decorators/require-role.decorator";
import { ResourceParam } from "../common/decorators/resource-param.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { InterfacesService } from "./interfaces.service";

const renameSchema = z.object({ name: z.string().min(1).max(120) });

@ApiTags("interfaces")
@ApiBearerAuth("access-token")
@Controller("interfaces")
export class InterfacesController {
  constructor(private readonly interfaces: InterfacesService) {}

  @Post()
  @RequireRole("editor")
  @ResourceParam("base", "baseId", "body")
  @ApiOperation({ summary: "Create an interface (a published-page container) on a base" })
  @ApiBody({
    schema: { type: "object", required: ["baseId", "name"], properties: { baseId: { type: "string" }, name: { type: "string" } } },
  })
  create(@Body(new ZodValidationPipe(createInterfaceSchema)) dto: any) {
    return this.interfaces.create(dto);
  }

  @Get()
  @RequireRole("viewer")
  @ResourceParam("base", "baseId", "query")
  @ApiOperation({ summary: "List interfaces on a base" })
  @ApiQuery({ name: "baseId" })
  list(@Query("baseId") baseId: string) {
    return this.interfaces.listForBase(baseId);
  }

  @Get(":interfaceId")
  @RequireRole("viewer")
  @ResourceParam("interface", "interfaceId")
  @ApiOperation({ summary: "Get an interface by id" })
  @ApiParam({ name: "interfaceId" })
  get(@Param("interfaceId") interfaceId: string) {
    return this.interfaces.getOrThrow(interfaceId);
  }

  @Patch(":interfaceId")
  @RequireRole("editor")
  @ResourceParam("interface", "interfaceId")
  @ApiOperation({ summary: "Rename an interface" })
  @ApiParam({ name: "interfaceId" })
  @ApiBody({ schema: { type: "object", required: ["name"], properties: { name: { type: "string" } } } })
  rename(@Param("interfaceId") interfaceId: string, @Body(new ZodValidationPipe(renameSchema)) dto: { name: string }) {
    return this.interfaces.rename(interfaceId, dto.name);
  }

  @Delete(":interfaceId")
  @RequireRole("admin")
  @ResourceParam("interface", "interfaceId")
  @ApiOperation({ summary: "Delete an interface and all its pages (requires admin role)" })
  @ApiParam({ name: "interfaceId" })
  remove(@Param("interfaceId") interfaceId: string) {
    return this.interfaces.remove(interfaceId);
  }

  @Post(":interfaceId/publish")
  @RequireRole("editor")
  @ResourceParam("interface", "interfaceId")
  @ApiOperation({ summary: "Publish an interface — mints a share token on first publish, then serves at /s/:token" })
  @ApiParam({ name: "interfaceId" })
  publish(@Param("interfaceId") interfaceId: string) {
    return this.interfaces.publish(interfaceId);
  }

  @Post(":interfaceId/unpublish")
  @RequireRole("editor")
  @ResourceParam("interface", "interfaceId")
  @ApiOperation({ summary: "Unpublish an interface — the public link 404s until republished" })
  @ApiParam({ name: "interfaceId" })
  unpublish(@Param("interfaceId") interfaceId: string) {
    return this.interfaces.unpublish(interfaceId);
  }

  @Post(":interfaceId/regenerate-token")
  @RequireRole("editor")
  @ResourceParam("interface", "interfaceId")
  @ApiOperation({ summary: "Invalidate the current public link and mint a new one" })
  @ApiParam({ name: "interfaceId" })
  regenerateToken(@Param("interfaceId") interfaceId: string) {
    return this.interfaces.regenerateToken(interfaceId);
  }
}
