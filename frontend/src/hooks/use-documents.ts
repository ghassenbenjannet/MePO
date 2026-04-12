import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Document, DocumentCreate, DocType } from "../types/domain";

export function useDocuments(opts: { spaceId?: string; topicId?: string; parentId?: string | null; type?: DocType } = {}) {
  const { spaceId, topicId, parentId, type } = opts;
  const params = new URLSearchParams();
  if (spaceId) params.set("space_id", spaceId);
  if (topicId) params.set("topic_id", topicId);
  if (parentId !== undefined) params.set("parent_id", parentId ?? "root");
  if (type) params.set("type", type);
  const qs = params.toString() ? `?${params.toString()}` : "";
  return useQuery<Document[]>({
    queryKey: ["documents", spaceId, topicId, parentId, type],
    queryFn: () => api.get<Document[]>(`/api/documents${qs}`),
    enabled: !!(spaceId || topicId),
  });
}

export function useDocument(id: string | null) {
  return useQuery<Document>({
    queryKey: ["document", id],
    queryFn: () => api.get<Document>(`/api/documents/${id}`),
    enabled: !!id,
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
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["document", vars.id] });
    },
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/documents/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });
}
