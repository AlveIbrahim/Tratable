import { Module } from "@nestjs/common";
import { ExportModule } from "../export/export.module";
import { TablesController } from "./tables.controller";
import { TablesService } from "./tables.service";

@Module({
  imports: [ExportModule],
  controllers: [TablesController],
  providers: [TablesService],
  exports: [TablesService],
})
export class TablesModule {}
