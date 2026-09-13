import { BadRequestException, PipeTransform } from "@nestjs/common";
import { ZodType } from "zod";

/** Validates+coerces `req.body`/`req.query` against a zod schema. Usage:
 * `@Body(new ZodValidationPipe(createBaseSchema)) dto: CreateBaseDto`. */
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: "Validation failed",
        issues: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
    return result.data;
  }
}
