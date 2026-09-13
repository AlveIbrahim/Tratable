import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { DatabaseModule } from "./database/database.module";
import { AuthModule } from "./auth/auth.module";
import { WorkspacesModule } from "./workspaces/workspaces.module";
import { BasesModule } from "./bases/bases.module";
import { TablesModule } from "./tables/tables.module";
import { FieldsModule } from "./fields/fields.module";
import { ViewsModule } from "./views/views.module";
import { RecordsModule } from "./records/records.module";
import { CsvModule } from "./csv/csv.module";
import { InterfacesModule } from "./interfaces/interfaces.module";
import { PublicModule } from "./public/public.module";
import { RequestLoggerMiddleware } from "./common/middleware/request-logger.middleware";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    DatabaseModule,
    AuthModule,
    WorkspacesModule,
    BasesModule,
    TablesModule,
    FieldsModule,
    ViewsModule,
    RecordsModule,
    CsvModule,
    InterfacesModule,
    PublicModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes("*");
  }
}
