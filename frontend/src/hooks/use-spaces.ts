import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Space, SpaceCreate } from "../types/domain";

export function useSpaces(projectId?: string) {
  const params = projectId ? `?project_id=${projectId}` : "";
  return useQuery<Space[]>({
    queryKey: ["spaces", projectId],
    queryFn: () => api.get<Space[]>(`/api/spaces${params}`),
    enabled: !!projectId,
  });
}

export function useSpace(spaceId: string | undefined) {
  return useQuery<Space>({
    queryKey: ["spaces", "detail", spaceId],
    queryFn: () => api.get<Space>(`/api/spaces/${spaceId}`),
    enabled: !!spaceId,
  });
}

export function useCreateSpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SpaceCreate) => api.post<Space>("/api/spaces", data),
    onSuccess: (_data, variables) =>
      qc.invalidateQueries({ queryKey: ["spaces", variables.project_id] }),
  });
}

export function useUpdateSpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Space> & { id: string }) =>
      api.patch<Space>(`/api/spaces/${id}`, data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["spaces"] });
      qc.invalidateQueries({ queryKey: ["spaces", "detail", data.id] });
    },
  });
}
