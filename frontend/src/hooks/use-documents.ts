import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Document, DocumentCreate } from "../types/domain";

export function useDocuments(opts: { spaceId?: string; topicId?: string } = {}) {
  const { spaceId, topicId } = opts;
  const params = new URLSearchParams();
  if (spaceId) params.set("space_id", spaceId);
  if (topicId) params.set("topic_id", topicId);
  const qs = params.toString() ? `?${params.toString()}` : "";
  return useQuery<Document[]>({
    queryKey: ["documents", spaceId, topicId],
    queryFn: () => api.get<Document[]>(`/api/documents${qs}`),
    enabled: !!(spaceId || topicId),
  });
}

export function useCreateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: DocumentCreate) => api.post<Document>("/api/documents", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });
}

export function useUpdateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Document> & { id: string }) =>
      api.patch<Document>(`/api/documents/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });
}
