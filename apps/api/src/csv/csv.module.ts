import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import multer from "multer";
import { CsvController } from "./csv.controller";
import { CsvService } from "./csv.service";
import { importUploadOptions } from "./multer.config";

/**
 * The upload route is guarded by @RequireRole('editor') + @ResourceParam
 * reading `baseId` from the multipart body — but Nest's request lifecycle
 * runs middleware BEFORE guards, and guards BEFORE interceptors. multer's
 * usual home, @UseInterceptors(FileInterceptor(...)), is an interceptor,
 * so it would parse the multipart body *after* the guard already tried
 * (and failed) to read `baseId` from an as-yet-unparsed body.
 *
 * Applying multer here as plain Express middleware instead makes it run
 * before the guard, so `req.body.baseId` and `req.file` are both populated
 * by the time WorkspaceRoleGuard inspects the request.
 */
@Module({
  controllers: [CsvController],
  providers: [CsvService],
})
export class CsvModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(multer(importUploadOptions).single("file"))
      .forRoutes({ path: "imports", method: RequestMethod.POST });
  }
}
