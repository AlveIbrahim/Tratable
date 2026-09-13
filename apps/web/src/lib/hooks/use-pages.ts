import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PageConfig } from "@tratable/shared";
import { api } from "../api-client";

export interface PageSummary {
  id: string;
  interface_id: string;
  name: string;
  slug: string;
  type: string;
  config: PageConfig;
  pos: number;
}

export function usePages(interfaceId: string | undefined) {
  return useQuery({
    queryKey: ["pages", interfaceId],
    queryFn: () => api.get<PageSummary[]>("/pages", { interfaceId }),
    enabled: !!interfaceId,
  });
}

export function useCreatePage(interfaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, config }: { name: string; config: PageConfig }) =>
      api.post<PageSummary>("/pages", { interfaceId, name, config }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pages", interfaceId] }),
  });
}

export function useUpdatePage(interfaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name, config }: { id: string; name?: string; config?: PageConfig }) =>
      api.patch<PageSummary>(`/pages/${id}`, { name, config }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pages", interfaceId] }),
  });
}

export function useDeletePage(interfaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/pages/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pages", interfaceId] }),
  });
}
