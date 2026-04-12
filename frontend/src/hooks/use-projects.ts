import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Project, ProjectCreate } from "../types/domain";

export function useProjects() {
  return useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: () => api.get<Project[]>("/api/projects"),
  });
}

export function useProjectSuggestions(query: string) {
  return useQuery<Project[]>({
    queryKey: ["projects", "suggestions", query],
    queryFn: () => api.get<Project[]>(`/api/projects?q=${encodeURIComponent(query)}`),
    enabled: query.trim().length > 0,
  });
}

export function useProject(projectId: string | undefined) {
  return useQuery<Project>({
    queryKey: ["projects", projectId],
    queryFn: () => api.get<Project>(`/api/projects/${projectId}`),
    enabled: !!projectId,
  });
}

export function useProjectStats(projectId: string | undefined) {
  return useQuery<{ spaces: number; topics: number; tickets: number; documents: number }>({
    queryKey: ["projects", projectId, "stats"],
    queryFn: () => api.get(`/api/projects/${projectId}/stats`),
    enabled: !!projectId,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ProjectCreate) => api.post<Project>("/api/projects", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/projects/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}
