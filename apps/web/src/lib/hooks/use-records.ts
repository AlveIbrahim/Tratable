import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { FilterNode, PaginatedRecords, RecordDto, SortSpec } from "@tratable/shared";
import { api } from "../api-client";

const PAGE_SIZE = 200;

export function useRecords(tableId: string | undefined, filters?: FilterNode, sorts?: SortSpec[]) {
  return useInfiniteQuery({
    queryKey: ["records", tableId, filters, sorts],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      api.get<PaginatedRecords>(`/tables/${tableId}/records`, {
        cursor: pageParam,
        limit: PAGE_SIZE,
        filters,
        sorts,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!tableId,
  });
}

export function useCreateRecord(tableId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<RecordDto>(`/tables/${tableId}/records`, { data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["records", tableId] }),
  });
}

/** Optimistic single-cell update: patches the cached page data immediately,
 * rolls back on error. Debouncing the actual network call is the caller's
 * job (the grid cell editor debounces keystrokes before calling this). */
export function useUpdateRecord(tableId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ recordId, data }: { recordId: string; data: Record<string, unknown> }) =>
      api.patch<RecordDto>(`/records/${recordId}`, { data }),
    onMutate: async ({ recordId, data }) => {
      await qc.cancelQueries({ queryKey: ["records", tableId] });
      const previous = qc.getQueriesData<{ pages: PaginatedRecords[] }>({ queryKey: ["records", tableId] });

      qc.setQueriesData<{ pages: PaginatedRecords[]; pageParams: unknown[] } | undefined>(
        { queryKey: ["records", tableId] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              records: page.records.map((r) =>
                r.id === recordId ? { ...r, data: { ...r.data, ...data } } : r,
              ),
            })),
          };
        },
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      context?.previous.forEach(([key, value]) => qc.setQueryData(key, value));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["records", tableId] }),
  });
}

export function useDeleteRecord(tableId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (recordId: string) => api.delete(`/records/${recordId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["records", tableId] }),
  });
}
