import { Module } from "@nestjs/common";
import { FieldsModule } from "../fields/fields.module";
import { DashboardService } from "./dashboard.service";

@Module({
  imports: [FieldsModule],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class QueryModule {}
