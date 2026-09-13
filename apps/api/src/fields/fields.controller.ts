import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { changeFieldTypeSchema, createFieldSchema, updateFieldSchema } from "@tratable/shared";
import { RequireRole } from "../common/decorators/require-role.decorator";
import { ResourceParam } from "../common/decorators/resource-param.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { FieldsService } from "./fields.service";

@Controller("fields")
export class FieldsController {
  constructor(private readonly fields: FieldsService) {}

  @Post()
  @RequireRole("editor")
  @ResourceParam("table", "tableId", "body")
  create(@Body(new ZodValidationPipe(createFieldSchema)) dto: any) {
    return this.fields.create(dto);
  }

  @Get()
  @RequireRole("viewer")
  @ResourceParam("table", "tableId", "query")
  list(@Query("tableId") tableId: string) {
    return this.fields.listForTable(tableId);
  }

  @Patch(":fieldId")
  @RequireRole("editor")
  @ResourceParam("field", "fieldId")
  update(@Param("fieldId") fieldId: string, @Body(new ZodValidationPipe(updateFieldSchema)) dto: any) {
    return this.fields.update(fieldId, dto);
  }

  @Post(":fieldId/change-type")
  @RequireRole("editor")
  @ResourceParam("field", "fieldId")
  changeType(@Param("fieldId") fieldId: string, @Body(new ZodValidationPipe(changeFieldTypeSchema)) dto: any) {
    return this.fields.changeType(fieldId, dto);
  }

  @Delete(":fieldId")
  @RequireRole("admin")
  @ResourceParam("field", "fieldId")
  remove(@Param("fieldId") fieldId: string) {
    return this.fields.softDelete(fieldId);
  }
}
