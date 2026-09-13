import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api-client";

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  role: "owner" | "admin" | "editor" | "viewer";
}

export function useWorkspaces() {
  return useQuery({
    queryKey: ["workspaces"],
    queryFn: () => api.get<WorkspaceSummary[]>("/workspaces"),
  });
}

export function useCreateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.post("/workspaces", { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspaces"] }),
  });
}
