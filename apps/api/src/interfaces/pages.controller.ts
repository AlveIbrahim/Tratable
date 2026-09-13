import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { createPageSchema, DashboardWidget, previewDashboardSchema, updatePageSchema } from "@tratable/shared";
import { RequireRole } from "../common/decorators/require-role.decorator";
import { ResourceParam } from "../common/decorators/resource-param.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { PagesService } from "./pages.service";

const PAGE_CONFIG_BODY = {
  type: "object",
  description:
    "A discriminated union on `type`: grid | record_detail | list | dashboard | form. " +
    "See PageConfig in @tratable/shared for the exact shape of each.",
};

@ApiTags("interfaces")
@ApiBearerAuth("access-token")
@Controller("pages")
export class PagesController {
  constructor(private readonly pages: PagesService) {}

  @Post()
  @RequireRole("editor")
  @ResourceParam("interface", "interfaceId", "body")
  @ApiOperation({ summary: "Add a page to an interface" })
  @ApiBody({
    schema: {
      type: "object",
      required: ["interfaceId", "name", "config"],
      properties: { interfaceId: { type: "string" }, name: { type: "string" }, config: PAGE_CONFIG_BODY },
    },
  })
  create(@Body(new ZodValidationPipe(createPageSchema)) dto: any) {
    return this.pages.create(dto);
  }

  @Get()
  @RequireRole("viewer")
  @ResourceParam("interface", "interfaceId", "query")
  @ApiOperation({ summary: "List pages on an interface" })
  @ApiQuery({ name: "interfaceId" })
  list(@Query("interfaceId") interfaceId: string) {
    return this.pages.listForInterface(interfaceId);
  }

  @Get(":pageId")
  @RequireRole("viewer")
  @ResourceParam("page", "pageId")
  @ApiOperation({ summary: "Get a page by id" })
  @ApiParam({ name: "pageId" })
  get(@Param("pageId") pageId: string) {
    return this.pages.getOrThrow(pageId);
  }

  @Patch(":pageId")
  @RequireRole("editor")
  @ResourceParam("page", "pageId")
  @ApiOperation({ summary: "Rename a page, reorder it, or replace its config" })
  @ApiParam({ name: "pageId" })
  @ApiBody({ schema: { type: "object", properties: { name: { type: "string" }, pos: { type: "number" }, config: PAGE_CONFIG_BODY } } })
  update(@Param("pageId") pageId: string, @Body(new ZodValidationPipe(updatePageSchema)) dto: any) {
    return this.pages.update(pageId, dto);
  }

  @Delete(":pageId")
  @RequireRole("editor")
  @ResourceParam("page", "pageId")
  @ApiOperation({ summary: "Delete a page" })
  @ApiParam({ name: "pageId" })
  remove(@Param("pageId") pageId: string) {
    return this.pages.remove(pageId);
  }

  @Post(":pageId/dashboard-preview")
  @RequireRole("viewer")
  @ResourceParam("page", "pageId")
  @ApiOperation({
    summary: "Compute dashboard widget values for the builder's live preview",
    description:
      "Takes the widget list currently being edited (not necessarily saved yet) and returns the same shape " +
      "the public route's dashboard endpoint does, so a widget looks identical before and after publishing.",
  })
  @ApiParam({ name: "pageId" })
  @ApiBody({ schema: { type: "object", required: ["widgets"], properties: { widgets: { type: "array", items: { type: "object" } } } } })
  previewDashboard(@Param("pageId") pageId: string, @Body(new ZodValidationPipe(previewDashboardSchema)) dto: { widgets: DashboardWidget[] }) {
    return this.pages.previewDashboard(pageId, dto.widgets);
  }
}
