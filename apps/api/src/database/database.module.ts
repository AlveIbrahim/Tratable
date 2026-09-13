import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DatabaseService } from "./database.service";

@Global()
@Module({
  providers: [
    {
      provide: DatabaseService,
      useFactory: (config: ConfigService) => new DatabaseService(config),
      inject: [ConfigService],
    },
  ],
  exports: [DatabaseService],
})
export class DatabaseModule {}
