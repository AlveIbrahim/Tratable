import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DashboardWidget, PageConfig } from "@tratable/shared";
import { api } from "../api-client";
import type { PublicDashboard } from "./use-public";

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

/** Computes real widget numbers for the *currently edited* (possibly
 * unsaved) dashboard config, so the builder's preview shows the same thing
 * a viewer would see on the public page — without requiring a save/publish
 * round trip first. Keyed on the widget list itself so it recomputes as
 * soon as a widget changes, same as every other page type's live preview. */
export function useDashboardPreview(pageId: string | undefined, widgets: DashboardWidget[]) {
  return useQuery({
    queryKey: ["pages", pageId, "dashboard-preview", widgets],
    queryFn: () => api.post<PublicDashboard>(`/pages/${pageId}/dashboard-preview`, { widgets }),
    enabled: !!pageId && widgets.length > 0,
  });
}
