import { attachmentField } from "./definitions/attachment";
import { checkboxField } from "./definitions/checkbox";
import { dateField, dateTimeField } from "./definitions/date";
import { emailField, phoneField, urlField } from "./definitions/contact";
import { linkToRecordField } from "./definitions/link";
import { numberField } from "./definitions/number";
import { multiSelectField, singleSelectField } from "./definitions/select";
import { autoNumberField, createdTimeField, lastModifiedTimeField } from "./definitions/system";
import { longTextField, singleLineTextField } from "./definitions/text";
import { FieldType, FieldTypeDef } from "./types";

export const FIELD_REGISTRY: Record<FieldType, FieldTypeDef<any, any>> = {
  singleLineText: singleLineTextField,
  longText: longTextField,
  number: numberField,
  checkbox: checkboxField,
  singleSelect: singleSelectField,
  multiSelect: multiSelectField,
  date: dateField,
  dateTime: dateTimeField,
  email: emailField,
  url: urlField,
  phone: phoneField,
  attachment: attachmentField,
  linkToRecord: linkToRecordField,
  autoNumber: autoNumberField,
  createdTime: createdTimeField,
  lastModifiedTime: lastModifiedTimeField,
};

export function getFieldType(type: FieldType): FieldTypeDef<any, any> {
  const def = FIELD_REGISTRY[type];
  if (!def) throw new Error(`Unknown field type "${type}"`);
  return def;
}

/**
 * Type-inference priority order for CSV import (packages/shared/src/fields/infer.ts
 * uses this). Order matters: checkbox before number (so "0"/"1" columns of a
 * handful of booleans don't get eaten by number), select types are tried only
 * after every typed scalar has failed to match confidently.
 */
export const INFERENCE_ORDER: FieldType[] = [
  "checkbox",
  "number",
  "date",
  "dateTime",
  "email",
  "url",
  "phone",
  "singleSelect",
  "multiSelect",
  "singleLineText", // fallback, always matches
];
