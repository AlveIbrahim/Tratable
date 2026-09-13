import { Module } from "@nestjs/common";
import { ExportModule } from "../export/export.module";
import { BasesController } from "./bases.controller";
import { BasesService } from "./bases.service";

@Module({
  imports: [ExportModule],
  controllers: [BasesController],
  providers: [BasesService],
  exports: [BasesService],
})
export class BasesModule {}
