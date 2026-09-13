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
import * as fs from "node:fs";
import { executeImportSchema } from "@tratable/shared";
import { CurrentUser, RequestUser } from "../common/decorators/current-user.decorator";
import { RequireRole } from "../common/decorators/require-role.decorator";
import { ResourceParam } from "../common/decorators/resource-param.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CsvService } from "./csv.service";

@Controller("imports")
export class CsvController {
  constructor(private readonly csv: CsvService) {}

  @Post()
  @RequireRole("editor")
  @ResourceParam("base", "baseId", "body")
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
  analyze(@Param("id") id: string) {
    return this.csv.analyze(id);
  }

  @Post(":id/execute")
  @RequireRole("editor")
  @ResourceParam("importJob", "id")
  async execute(@Param("id") id: string, @Body(new ZodValidationPipe(executeImportSchema)) dto: any) {
    await this.csv.startExecute(id, dto);
    return { id, status: "running" };
  }

  @Get(":id")
  @RequireRole("viewer")
  @ResourceParam("importJob", "id")
  status(@Param("id") id: string) {
    return this.csv.getStatus(id);
  }

  @Get(":id/error-report")
  @RequireRole("viewer")
  @ResourceParam("importJob", "id")
  async errorReport(@Param("id") id: string): Promise<StreamableFile> {
    const filePath = await this.csv.getErrorReportPath(id);
    return new StreamableFile(fs.createReadStream(filePath), {
      type: "text/csv",
      disposition: `attachment; filename="import-${id}-errors.csv"`,
    });
  }
}
