import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ExecuteImportDto, ImportAnalysis, ImportJobStatus } from "@tratable/shared";
import { ApiError } from "../api-client";
import { useAuthStore } from "../auth-store";

/** File upload needs multipart/form-data, which the shared JSON api-client
 * doesn't support — a small parallel fetch wrapper that still attaches the
 * bearer token and cookie the same way. */
async function uploadImport(baseId: string, file: File): Promise<{ id: string; filename: string; originalName: string }> {
  const token = useAuthStore.getState().accessToken;
  const form = new FormData();
  form.append("baseId", baseId);
  form.append("file", file);

  const res = await fetch("/api/imports", {
    method: "POST",
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? "Upload failed");
  }
  return res.json();
}

export function useUploadImport() {
  return useMutation({ mutationFn: ({ baseId, file }: { baseId: string; file: File }) => uploadImport(baseId, file) });
}

async function apiGet<T>(path: string): Promise<T> {
  const token = useAuthStore.getState().accessToken;
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new ApiError(res.status, "Request failed");
  return res.json();
}

async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const token = useAuthStore.getState().accessToken;
  const res = await fetch(`/api${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, errBody.message ?? "Request failed", errBody.issues);
  }
  return res.json();
}

export function useAnalyzeImport(jobId: string | undefined) {
  return useQuery({
    queryKey: ["import-analysis", jobId],
    queryFn: () => apiGet<ImportAnalysis>(`/imports/${jobId}/analyze`),
    enabled: !!jobId,
    staleTime: Infinity,
  });
}

export function useExecuteImport() {
  return useMutation({
    mutationFn: ({ jobId, dto }: { jobId: string; dto: ExecuteImportDto }) =>
      apiPost<{ id: string; status: string }>(`/imports/${jobId}/execute`, dto),
  });
}

export function useImportStatus(jobId: string | undefined, poll: boolean) {
  return useQuery({
    queryKey: ["import-status", jobId],
    queryFn: () => apiGet<ImportJobStatus>(`/imports/${jobId}`),
    enabled: !!jobId,
    refetchInterval: (query) => {
      if (!poll) return false;
      const status = query.state.data?.status;
      return status === "completed" || status === "failed" ? false : 1000;
    },
  });
}

export function useInvalidateAfterImport() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["tables"] });
    qc.invalidateQueries({ queryKey: ["fields"] });
    qc.invalidateQueries({ queryKey: ["records"] });
  };
}
