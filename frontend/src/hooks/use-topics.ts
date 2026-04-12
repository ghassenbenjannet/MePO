import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Topic, TopicCreate } from "../types/domain";

export function useTopics(spaceId?: string) {
  const params = spaceId ? `?space_id=${spaceId}` : "";
  return useQuery<Topic[]>({
    queryKey: ["topics", spaceId],
    queryFn: () => api.get<Topic[]>(`/api/topics${params}`),
    enabled: !!spaceId,
  });
}

export function useTopic(topicId: string | undefined) {
  return useQuery<Topic>({
    queryKey: ["topics", "detail", topicId],
    queryFn: () => api.get<Topic>(`/api/topics/${topicId}`),
    enabled: !!topicId,
  });
}

export function useCreateTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: TopicCreate) => api.post<Topic>("/api/topics", data),
    onSuccess: (_data, variables) =>
      qc.invalidateQueries({ queryKey: ["topics", variables.space_id] }),
  });
}

export function useUpdateTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Topic> & { id: string }) =>
      api.patch<Topic>(`/api/topics/${id}`, data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["topics"] });
      qc.invalidateQueries({ queryKey: ["topics", "detail", data.id] });
    },
  });
}
