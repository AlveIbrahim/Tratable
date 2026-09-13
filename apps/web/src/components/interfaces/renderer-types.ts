import type { FieldType } from "@tratable/shared";

/** The minimal field shape every renderer needs — a strict subset of the
 * authenticated FieldSummary and exactly what the public API's
 * GET /public/:token/pages/:pageSlug returns. Renderers are deliberately
 * typed against this common shape (not the richer authenticated type) so
 * the same component works unmodified in the builder's authenticated
 * preview and in the public /s/:token page — the "one renderer, two mount
 * points" rule from docs/PLAN.md. */
export interface RendererField {
  id: string;
  name: string;
  type: FieldType;
  options: Record<string, unknown>;
}

export interface RendererRecord {
  id: string;
  data: Record<string, unknown>;
}
