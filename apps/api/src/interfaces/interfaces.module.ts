import { Module } from "@nestjs/common";
import { InterfacesController } from "./interfaces.controller";
import { InterfacesService } from "./interfaces.service";
import { PagesController } from "./pages.controller";
import { PagesService } from "./pages.service";

@Module({
  controllers: [InterfacesController, PagesController],
  providers: [InterfacesService, PagesService],
  exports: [InterfacesService, PagesService],
})
export class InterfacesModule {}
