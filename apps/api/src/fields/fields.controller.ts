import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiParam, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { changeFieldTypeSchema, createFieldSchema, updateFieldSchema } from "@tratable/shared";
import { RequireRole } from "../common/decorators/require-role.decorator";
import { ResourceParam } from "../common/decorators/resource-param.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { FieldsService } from "./fields.service";

const FIELD_TYPES = [
  "singleLineText", "longText", "number", "checkbox", "singleSelect",
  "multiSelect", "date", "dateTime", "email", "url", "phone", "attachment",
  "linkToRecord", "autoNumber", "createdTime", "lastModifiedTime",
];

@ApiTags("fields")
@ApiBearerAuth("access-token")
@Controller("fields")
export class FieldsController {
  constructor(private readonly fields: FieldsService) {}

  @Post()
  @RequireRole("editor")
  @ResourceParam("table", "tableId", "body")
  @ApiOperation({ summary: "Create a field (column) on a table" })
  @ApiBody({
    schema: {
      type: "object",
      required: ["tableId", "name", "type"],
      properties: {
        tableId: { type: "string" },
        name: { type: "string" },
        type: { type: "string", enum: FIELD_TYPES },
        options: {
          type: "object",
          description: "Type-specific options, e.g. { choices: [{id,name}] } for select types",
        },
      },
    },
  })
  create(@Body(new ZodValidationPipe(createFieldSchema)) dto: any) {
    return this.fields.create(dto);
  }

  @Get()
  @RequireRole("viewer")
  @ResourceParam("table", "tableId", "query")
  @ApiOperation({ summary: "List fields on a table" })
  @ApiQuery({ name: "tableId" })
  list(@Query("tableId") tableId: string) {
    return this.fields.listForTable(tableId);
  }

  @Patch(":fieldId")
  @RequireRole("editor")
  @ResourceParam("field", "fieldId")
  @ApiOperation({ summary: "Rename a field, change its position, or merge-patch its options" })
  @ApiParam({ name: "fieldId" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        options: { type: "object" },
        pos: { type: "number" },
      },
    },
  })
  update(@Param("fieldId") fieldId: string, @Body(new ZodValidationPipe(updateFieldSchema)) dto: any) {
    return this.fields.update(fieldId, dto);
  }

  @Post(":fieldId/change-type")
  @RequireRole("editor")
  @ResourceParam("field", "fieldId")
  @ApiOperation({
    summary: "Change a field's type, converting existing values",
    description:
      "Pass dryRun:true to preview how many values would convert vs. be cleared, without writing anything.",
  })
  @ApiParam({ name: "fieldId" })
  @ApiBody({
    schema: {
      type: "object",
      required: ["newType"],
      properties: {
        newType: { type: "string", enum: FIELD_TYPES },
        newOptions: { type: "object" },
        dryRun: { type: "boolean", default: false },
      },
    },
  })
  changeType(@Param("fieldId") fieldId: string, @Body(new ZodValidationPipe(changeFieldTypeSchema)) dto: any) {
    return this.fields.changeType(fieldId, dto);
  }

  @Delete(":fieldId")
  @RequireRole("admin")
  @ResourceParam("field", "fieldId")
  @ApiOperation({ summary: "Soft-delete a field (a table's primary field cannot be deleted)" })
  @ApiParam({ name: "fieldId" })
  remove(@Param("fieldId") fieldId: string) {
    return this.fields.softDelete(fieldId);
  }
}
