import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api-client";

export interface InterfaceSummary {
  id: string;
  base_id: string;
  name: string;
  slug: string;
  share_token: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export function useInterfaces(baseId: string | undefined) {
  return useQuery({
    queryKey: ["interfaces", baseId],
    queryFn: () => api.get<InterfaceSummary[]>("/interfaces", { baseId }),
    enabled: !!baseId,
  });
}

export function useInterface(interfaceId: string | undefined) {
  return useQuery({
    queryKey: ["interfaces", "detail", interfaceId],
    queryFn: () => api.get<InterfaceSummary>(`/interfaces/${interfaceId}`),
    enabled: !!interfaceId,
  });
}

export function useCreateInterface(baseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.post<InterfaceSummary>("/interfaces", { baseId, name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["interfaces", baseId] }),
  });
}

export function useRenameInterface(baseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.patch<InterfaceSummary>(`/interfaces/${id}`, { name }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["interfaces", baseId] });
      qc.setQueryData(["interfaces", "detail", data.id], data);
    },
  });
}

export function useDeleteInterface(baseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/interfaces/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["interfaces", baseId] }),
  });
}

function invalidateOne(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: ["interfaces", "detail", id] });
  qc.invalidateQueries({ queryKey: ["interfaces"] });
}

export function usePublishInterface() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<InterfaceSummary>(`/interfaces/${id}/publish`),
    onSuccess: (data) => invalidateOne(qc, data.id),
  });
}

export function useUnpublishInterface() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<InterfaceSummary>(`/interfaces/${id}/unpublish`),
    onSuccess: (data) => invalidateOne(qc, data.id),
  });
}

export function useRegenerateToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<InterfaceSummary>(`/interfaces/${id}/regenerate-token`),
    onSuccess: (data) => invalidateOne(qc, data.id),
  });
}
