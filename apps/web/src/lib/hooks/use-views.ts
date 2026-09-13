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

export function useUpdateView(tableId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ viewId, config }: { viewId: string; config: Partial<ViewConfig> }) =>
      api.patch<ViewSummary>(`/views/${viewId}`, { config }),
    // Optimistic: the toolbar should react the instant a filter/sort/group/
    // color choice changes, not wait on a round trip — a view is edited far
    // more often than it's read, and there's only one writer in practice.
    onMutate: async ({ viewId, config }) => {
      await qc.cancelQueries({ queryKey: ["views", tableId] });
      const previous = qc.getQueryData<ViewSummary[]>(["views", tableId]);
      qc.setQueryData<ViewSummary[]>(["views", tableId], (old) =>
        old?.map((v) => (v.id === viewId ? { ...v, config: { ...v.config, ...config } } : v)),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(["views", tableId], context.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["views", tableId] }),
  });
}
