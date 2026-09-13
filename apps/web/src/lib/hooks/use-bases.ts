import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api-client";

export interface BaseSummary {
  id: string;
  workspace_id: string;
  name: string;
  icon: string | null;
  color: string | null;
}

export function useBases(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["bases", workspaceId],
    queryFn: () => api.get<BaseSummary[]>("/bases", { workspaceId }),
    enabled: !!workspaceId,
  });
}

export function useBase(baseId: string | undefined) {
  return useQuery({
    queryKey: ["bases", "detail", baseId],
    queryFn: () => api.get<BaseSummary>(`/bases/${baseId}`),
    enabled: !!baseId,
  });
}

export function useCreateBase(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.post<BaseSummary>("/bases", { workspaceId, name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bases", workspaceId] }),
  });
}
