import { getFieldType, INFERENCE_ORDER } from "./registry";
import { FieldType } from "./types";

export interface InferredField {
  type: FieldType;
  options: Record<string, unknown>;
  confidence: number;
}

/**
 * Given raw sample strings from one CSV column, pick the best-fit field type.
 * Tries each type in INFERENCE_ORDER and keeps the first with confidence >= 0.7,
 * falling back to singleLineText (which always matches) otherwise.
 */
export function inferColumnType(samples: string[]): InferredField {
  for (const type of INFERENCE_ORDER) {
    if (type === "singleLineText") continue; // fallback handled below
    const def = getFieldType(type);
    const result = def.inferFromSamples(samples);
    if (result && result.confidence >= 0.7) {
      return { type, options: result.options, confidence: result.confidence };
    }
  }
  const fallback = getFieldType("singleLineText").inferFromSamples(samples);
  return { type: "singleLineText", options: fallback?.options ?? {}, confidence: fallback?.confidence ?? 0.3 };
}
