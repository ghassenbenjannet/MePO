import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Document, DocumentCreate, DocType } from "../types/domain";

export interface ProjectDocumentsSyncStatus {
  project_id: string;
  google_sync_status: string;
  corpus_status: string;
  active_corpus_version: string | null;
  last_sync_started_at: string | null;
  last_sync_finished_at: string | null;
  last_error: string | null;
  synced_documents: number;
  eligible_documents: number;
}

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

export function useProjectDocumentsSyncStatus(projectId: string | undefined) {
  return useQuery<ProjectDocumentsSyncStatus>({
    queryKey: ["documents-sync", projectId],
    queryFn: () => api.get<ProjectDocumentsSyncStatus>(`/api/projects/${projectId}/documents/sync-status`),
    enabled: !!projectId,
  });
}

export function useCreateDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: DocumentCreate) => api.post<Document>("/api/documents", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents"] }),
  });
}

export function useUpdateDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Document> & { id: string }) =>
      api.patch<Document>(`/api/documents/${id}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["document", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["documents-sync"] });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/documents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["documents-sync"] });
    },
  });
}

export function useSyncProjectDocuments(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<ProjectDocumentsSyncStatus>(`/api/projects/${projectId}/documents/sync`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["documents-sync", projectId] });
    },
  });
}

export function useSyncDocument(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => api.post<Document>(`/api/documents/${documentId}/sync`, {}),
    onSuccess: (document) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["document", document.id] });
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ["documents-sync", projectId] });
      }
    },
  });
}
