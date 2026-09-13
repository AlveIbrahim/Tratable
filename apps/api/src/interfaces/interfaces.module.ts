import { Module } from "@nestjs/common";
import { QueryModule } from "../query/query.module";
import { InterfacesController } from "./interfaces.controller";
import { InterfacesService } from "./interfaces.service";
import { PagesController } from "./pages.controller";
import { PagesService } from "./pages.service";

@Module({
  imports: [QueryModule],
  controllers: [InterfacesController, PagesController],
  providers: [InterfacesService, PagesService],
  exports: [InterfacesService, PagesService],
})
export class InterfacesModule {}
