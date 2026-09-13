import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Public } from "../common/decorators/public.decorator";
import { PublicService } from "./public.service";

/**
 * The entire unauthenticated surface of the app lives here, one route per
 * concern, all gated by a share token rather than a session — see
 * PublicService for the actual allowlisting logic. Nothing in this
 * controller trusts a client-supplied field list or filter; it only ever
 * asks PublicService for "page X of interface Y", and the service decides
 * what that's allowed to include.
 */
@ApiTags("public")
@Controller("public")
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Public()
  @Get(":token")
  @ApiOperation({ summary: "Resolve a share token to its interface and page list" })
  @ApiParam({ name: "token" })
  getInterface(@Param("token") token: string) {
    return this.publicService.getInterface(token);
  }

  @Public()
  @Get(":token/pages/:pageSlug")
  @ApiOperation({ summary: "Get one published page's config and the field metadata it's allowed to show" })
  @ApiParam({ name: "token" })
  @ApiParam({ name: "pageSlug" })
  getPage(@Param("token") token: string, @Param("pageSlug") pageSlug: string) {
    return this.publicService.getPage(token, pageSlug);
  }

  @Public()
  @Get(":token/pages/:pageSlug/records")
  @ApiOperation({ summary: "List records for a grid/list page — keyset-paginated, fields limited to the page's allowlist" })
  @ApiParam({ name: "token" })
  @ApiParam({ name: "pageSlug" })
  @ApiQuery({ name: "cursor", required: false })
  @ApiQuery({ name: "limit", required: false })
  listRecords(
    @Param("token") token: string,
    @Param("pageSlug") pageSlug: string,
    @Query("cursor") cursor: string | undefined,
    @Query("limit") limit: string | undefined,
  ) {
    return this.publicService.listRecords(token, pageSlug, cursor, limit ? Number(limit) : 50);
  }

  @Public()
  @Get(":token/pages/:pageSlug/records/:recordId")
  @ApiOperation({ summary: "Get one record for a record_detail page, fields limited to the page's sections" })
  @ApiParam({ name: "token" })
  @ApiParam({ name: "pageSlug" })
  @ApiParam({ name: "recordId" })
  getRecord(@Param("token") token: string, @Param("pageSlug") pageSlug: string, @Param("recordId") recordId: string) {
    return this.publicService.getRecord(token, pageSlug, recordId);
  }

  @Public()
  @Get(":token/pages/:pageSlug/dashboard")
  @ApiOperation({ summary: "Get computed widget values/groups for a dashboard page" })
  @ApiParam({ name: "token" })
  @ApiParam({ name: "pageSlug" })
  getDashboard(@Param("token") token: string, @Param("pageSlug") pageSlug: string) {
    return this.publicService.getDashboard(token, pageSlug);
  }

  @Public()
  @Post(":token/pages/:pageSlug/submit")
  @ApiOperation({ summary: "Submit a form page — only keys named in the form's own field list are ever written" })
  @ApiParam({ name: "token" })
  @ApiParam({ name: "pageSlug" })
  submitForm(@Param("token") token: string, @Param("pageSlug") pageSlug: string, @Body() body: Record<string, unknown>) {
    return this.publicService.submitForm(token, pageSlug, body);
  }
}
