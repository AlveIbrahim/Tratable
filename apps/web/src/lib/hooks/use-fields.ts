import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FieldType } from "@tratable/shared";
import { api } from "../api-client";

export interface FieldSummary {
  id: string;
  table_id: string;
  name: string;
  type: FieldType;
  options: Record<string, unknown>;
  pos: number;
}

export function useFields(tableId: string | undefined) {
  return useQuery({
    queryKey: ["fields", tableId],
    queryFn: () => api.get<FieldSummary[]>("/fields", { tableId }),
    enabled: !!tableId,
  });
}

export function useCreateField(tableId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; type: FieldType; options?: Record<string, unknown> }) =>
      api.post<FieldSummary>("/fields", { tableId, ...input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fields", tableId] }),
  });
}

export function useUpdateField(tableId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fieldId, ...patch }: { fieldId: string; name?: string; options?: Record<string, unknown> }) =>
      api.patch<FieldSummary>(`/fields/${fieldId}`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fields", tableId] }),
  });
}

export function useDeleteField(tableId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fieldId: string) => api.delete(`/fields/${fieldId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fields", tableId] }),
  });
}
