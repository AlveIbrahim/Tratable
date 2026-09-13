import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiParam, ApiOperation, ApiTags } from "@nestjs/swagger";
import * as fs from "node:fs";
import { executeImportSchema } from "@tratable/shared";
import { CurrentUser, RequestUser } from "../common/decorators/current-user.decorator";
import { RequireRole } from "../common/decorators/require-role.decorator";
import { ResourceParam } from "../common/decorators/resource-param.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CsvService } from "./csv.service";

@ApiTags("imports")
@ApiBearerAuth("access-token")
@Controller("imports")
export class CsvController {
  constructor(private readonly csv: CsvService) {}

  @Post()
  @RequireRole("editor")
  @ResourceParam("base", "baseId", "body")
  @ApiOperation({ summary: "Upload a CSV/TSV file to import into a base (step 1 of 4 — upload, analyze, execute, poll)" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["baseId", "file"],
      properties: {
        baseId: { type: "string" },
        file: { type: "string", format: "binary" },
      },
    },
  })
  async upload(
    @Body("baseId") baseId: string,
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("No file uploaded");
    if (!baseId) throw new BadRequestException("baseId is required");
    return this.csv.createJob(baseId, user.id, file);
  }

  @Get(":id/analyze")
  @RequireRole("editor")
  @ResourceParam("importJob", "id")
  @ApiOperation({
    summary: "Sniff encoding/delimiter and infer a type per column (step 2 of 4)",
    description: "Stateless and safe to call repeatedly — recomputed from the stored file each time.",
  })
  @ApiParam({ name: "id" })
  analyze(@Param("id") id: string) {
    return this.csv.analyze(id);
  }

  @Post(":id/execute")
  @RequireRole("editor")
  @ResourceParam("importJob", "id")
  @ApiOperation({
    summary: "Start the import (step 3 of 4) — returns immediately with status 'running'; poll GET /imports/:id",
  })
  @ApiParam({ name: "id" })
  @ApiBody({
    schema: {
      type: "object",
      required: ["targetMode", "mappings"],
      properties: {
        targetMode: { type: "string", enum: ["new_table", "append", "upsert"] },
        tableId: { type: "string", description: "Required for append/upsert" },
        newTableName: { type: "string", description: "Required for new_table" },
        upsertKeyFieldId: { type: "string", description: "Required for upsert" },
        mappings: {
          type: "array",
          items: {
            type: "object",
            required: ["csvColumn", "action"],
            properties: {
              csvColumn: { type: "string" },
              action: { type: "string", enum: ["createField", "mapToField", "skip"] },
              fieldId: { type: "string", description: "Required when action = mapToField" },
              fieldName: { type: "string", description: "Required when action = createField" },
              fieldType: { type: "string", description: "Required when action = createField" },
            },
          },
        },
      },
    },
  })
  async execute(@Param("id") id: string, @Body(new ZodValidationPipe(executeImportSchema)) dto: any) {
    await this.csv.startExecute(id, dto);
    return { id, status: "running" };
  }

  @Get(":id")
  @RequireRole("viewer")
  @ResourceParam("importJob", "id")
  @ApiOperation({ summary: "Poll import job status/progress (step 4 of 4)" })
  @ApiParam({ name: "id" })
  status(@Param("id") id: string) {
    return this.csv.getStatus(id);
  }

  @Get(":id/error-report")
  @RequireRole("viewer")
  @ResourceParam("importJob", "id")
  @ApiOperation({ summary: "Download the CSV of per-cell parse failures, if any occurred" })
  @ApiParam({ name: "id" })
  async errorReport(@Param("id") id: string): Promise<StreamableFile> {
    const filePath = await this.csv.getErrorReportPath(id);
    return new StreamableFile(fs.createReadStream(filePath), {
      type: "text/csv",
      disposition: `attachment; filename="import-${id}-errors.csv"`,
    });
  }
}
