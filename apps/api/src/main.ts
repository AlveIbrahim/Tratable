import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix("api");
  app.use(cookieParser());
  app.enableCors({
    origin: config.get<string>("WEB_ORIGIN", "http://localhost:3000"),
    credentials: true,
  });
  app.useGlobalFilters(new HttpExceptionFilter());

  // Request/response bodies are validated by ZodValidationPipe against the
  // zod schemas in packages/shared, not class-validator DTOs — so Swagger
  // can't auto-derive body schemas the usual Nest way. Route paths, path/
  // query params, tags, and auth requirements are all still accurately
  // introspected; @ApiBody annotations on the write endpoints fill in the
  // request shapes Swagger can't see on its own. See docs/API.md for the
  // one-line justification kept alongside this if that split ever needs
  // revisiting.
  const swaggerConfig = new DocumentBuilder()
    .setTitle("Tratable API")
    .setDescription(
      "REST API for Tratable — bases, tables, fields, records, views, CSV import, and workspace/auth management. " +
        "Authenticate with POST /api/auth/login or /api/auth/register, then click Authorize and paste the " +
        "returned accessToken (no 'Bearer ' prefix needed) to try requests from this page.",
    )
    .setVersion("0.1.0")
    .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" }, "access-token")
    .addTag("auth", "Registration, login, token refresh")
    .addTag("workspaces", "Workspaces and membership")
    .addTag("bases", "Bases within a workspace")
    .addTag("tables", "Tables within a base")
    .addTag("fields", "Fields (columns) within a table")
    .addTag("views", "Saved filter/sort/field-visibility configs for a table")
    .addTag("records", "Rows within a table")
    .addTag("imports", "CSV upload, analysis, and execution")
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document);

  const port = config.get<number>("PORT", 3001);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Tratable API listening on :${port}`);
  // eslint-disable-next-line no-console
  console.log(`API docs at http://localhost:${port}/api/docs`);
}

bootstrap();
