import { Module } from "@nestjs/common";
import { FieldsModule } from "../fields/fields.module";
import { RecordsModule } from "../records/records.module";
import { QueryModule } from "../query/query.module";
import { PublicController } from "./public.controller";
import { PublicService } from "./public.service";

@Module({
  imports: [FieldsModule, RecordsModule, QueryModule],
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}
