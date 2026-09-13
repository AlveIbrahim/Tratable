import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FilterNode, SortSpec } from "@tratable/shared";
import { api } from "../api-client";

export interface ViewConfig {
  fieldOrder: string[];
  hiddenFieldIds: string[];
  filters?: FilterNode;
  sorts: SortSpec[];
  rowHeight: "short" | "medium" | "tall";
  groupByFieldId?: string;
  colorFieldId?: string;
}

export interface ViewSummary {
  id: string;
  table_id: string;
  name: string;
  type: string;
  config: ViewConfig;
  pos: number;
}

export function useViews(tableId: string | undefined) {
  return useQuery({
    queryKey: ["views", tableId],
    queryFn: () => api.get<ViewSummary[]>("/views", { tableId }),
    enabled: !!tableId,
  });
}

/** The grid works against a single "active" view per table — the first one,
 * which is always the auto-created default Grid view (tables.service.ts
 * creates it alongside the table itself). Multiple named views with a
 * switcher is a reasonable follow-up; not needed for filter/sort/group/color
 * to work today. */
export function useActiveView(tableId: string | undefined) {
  const { data: views, ...rest } = useViews(tableId);
  return { data: views?.[0], ...rest };
}

/** A config patch may need to *clear* a key (e.g. "Group by: None"), not just
 * set it — but `undefined` properties are dropped by JSON.stringify before
 * the request body is even built, so the server never sees they were sent
 * and can't tell "clear this" from "didn't mention this". `null` survives
 * JSON encoding, so it's the explicit clear signal; the server (and the
 * optimistic cache update below) both treat a `null` value as "delete this
 * key from config" rather than "set it to null". */
export type ViewConfigPatch = { [K in keyof ViewConfig]?: ViewConfig[K] | null };

export function useUpdateView(tableId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ viewId, config }: { viewId: string; config: ViewConfigPatch }) =>
      api.patch<ViewSummary>(`/views/${viewId}`, { config }),
    // Optimistic: the toolbar should react the instant a filter/sort/group/
    // color choice changes, not wait on a round trip — a view is edited far
    // more often than it's read, and there's only one writer in practice.
    onMutate: async ({ viewId, config }) => {
      await qc.cancelQueries({ queryKey: ["views", tableId] });
      const previous = qc.getQueryData<ViewSummary[]>(["views", tableId]);
      qc.setQueryData<ViewSummary[]>(["views", tableId], (old) =>
        old?.map((v) => {
          if (v.id !== viewId) return v;
          const merged: Record<string, unknown> = { ...v.config };
          for (const [key, value] of Object.entries(config)) {
            if (value === null) delete merged[key];
            else merged[key] = value;
          }
          return { ...v, config: merged as unknown as ViewConfig };
        }),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(["views", tableId], context.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["views", tableId] }),
  });
}
