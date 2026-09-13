import { useQuery } from "@tanstack/react-query";
import type { PageConfig } from "@tratable/shared";
import { api } from "../api-client";
import type { RendererField, RendererRecord } from "@/components/interfaces/renderer-types";

export interface PublicInterface {
  id: string;
  name: string;
  pages: { id: string; name: string; slug: string; type: string; pos: number }[];
}

export interface PublicPage {
  config: PageConfig;
  fields: RendererField[];
}

export function usePublicInterface(token: string | undefined) {
  return useQuery({
    queryKey: ["public", token],
    queryFn: () => api.get<PublicInterface>(`/public/${token}`),
    enabled: !!token,
    retry: false,
  });
}

export function usePublicPage(token: string | undefined, pageSlug: string | undefined) {
  return useQuery({
    queryKey: ["public", token, "pages", pageSlug],
    queryFn: () => api.get<PublicPage>(`/public/${token}/pages/${pageSlug}`),
    enabled: !!token && !!pageSlug,
    retry: false,
  });
}

export function usePublicRecords(token: string | undefined, pageSlug: string | undefined) {
  return useQuery({
    queryKey: ["public", token, "pages", pageSlug, "records"],
    queryFn: () => api.get<{ records: RendererRecord[]; nextCursor: string | null }>(`/public/${token}/pages/${pageSlug}/records`),
    enabled: !!token && !!pageSlug,
    retry: false,
  });
}

export function usePublicRecord(token: string | undefined, pageSlug: string | undefined, recordId: string | undefined) {
  return useQuery({
    queryKey: ["public", token, "pages", pageSlug, "records", recordId],
    queryFn: () => api.get<RendererRecord>(`/public/${token}/pages/${pageSlug}/records/${recordId}`),
    enabled: !!token && !!pageSlug && !!recordId,
    retry: false,
  });
}

export interface PublicDashboard {
  widgets: {
    type: "number" | "bar" | "line" | "pie";
    aggregation: { fn: "count" | "sum" | "avg" | "min" | "max"; fieldId?: string };
    value?: number | string;
    groups?: { bucket: unknown; value: number | string; label: string }[];
  }[];
}

export function usePublicDashboard(token: string | undefined, pageSlug: string | undefined) {
  return useQuery({
    queryKey: ["public", token, "pages", pageSlug, "dashboard"],
    queryFn: () => api.get<PublicDashboard>(`/public/${token}/pages/${pageSlug}/dashboard`),
    enabled: !!token && !!pageSlug,
    retry: false,
  });
}

export async function submitPublicForm(token: string, pageSlug: string, data: Record<string, unknown>) {
  return api.post<{ id: string; successMessage: string; redirectUrl?: string }>(
    `/public/${token}/pages/${pageSlug}/submit`,
    data,
  );
}
