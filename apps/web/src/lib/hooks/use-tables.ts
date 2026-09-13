import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api-client";

export interface TableSummary {
  id: string;
  base_id: string;
  name: string;
  description: string | null;
  pos: number;
  primary_field_id: string | null;
}

export function useTables(baseId: string | undefined) {
  return useQuery({
    queryKey: ["tables", baseId],
    queryFn: () => api.get<TableSummary[]>("/tables", { baseId }),
    enabled: !!baseId,
  });
}

export function useTable(tableId: string | undefined) {
  return useQuery({
    queryKey: ["tables", "detail", tableId],
    queryFn: () => api.get<TableSummary>(`/tables/${tableId}`),
    enabled: !!tableId,
  });
}

export function useCreateTable(baseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.post<TableSummary>("/tables", { baseId, name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tables", baseId] }),
  });
}

export function useDeleteTable(baseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tableId: string) => api.delete(`/tables/${tableId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tables", baseId] }),
  });
}
