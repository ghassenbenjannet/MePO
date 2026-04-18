import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export interface KnowledgeDoc {
  id: string;
  project_id: string;
  category: string;
  title: string;
  source_type: string;
  local_file_id: string | null;
  mime_type: string | null;
  original_filename: string | null;
  summary: string | null;
  tags: string[];
  linked_topic_ids: string[];
  content_hash: string | null;
  is_active: boolean;
  sync_status: string;
  synced_at: string | null;
  sync_error: string | null;
  openai_file_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface KnowledgeSettings {
  id: string | null;
  project_id: string;
  vector_store_id: string | null;
  last_sync_status: string;
  last_sync_started_at: string | null;
  last_sync_finished_at: string | null;
  last_sync_error: string | null;
  last_sync_summary_json: {
    scanned?: number;
    added?: number;
    updated?: number;
    ignored?: number;
    removed?: number;
    errors?: number;
    document_results?: Array<{
      document_id: string;
      title: string;
      status: string;
      message: string;
    }>;
  };
  created_at: string | null;
  updated_at: string | null;
}

export interface KnowledgeSyncResponse {
  project_id: string;
  vector_store_id: string;
  status: string;
  synced: number;
  skipped: number;
  no_file: number;
  errors: string[];
  summary: KnowledgeSettings["last_sync_summary_json"];
}

export interface KnowledgeDocCreate {
  title: string;
  category: string;
  source_type?: string;
  summary?: string | null;
  tags?: string[];
  linked_topic_ids?: string[];
}

export interface KnowledgeDocUpdate {
  title?: string;
  category?: string;
  summary?: string | null;
  tags?: string[];
  linked_topic_ids?: string[];
  is_active?: boolean;
}

export function useKnowledgeSettings(projectId: string | undefined) {
  return useQuery<KnowledgeSettings>({
    queryKey: ["knowledge-settings", projectId],
    queryFn: () => api.get<KnowledgeSettings>(`/api/projects/${projectId}/knowledge/settings`),
    enabled: !!projectId,
  });
}

export function useSaveKnowledgeSettings(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vectorStoreId: string | null) =>
      api.put<KnowledgeSettings>(`/api/projects/${projectId}/knowledge/settings`, {
        vectorStoreId,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["knowledge-settings", projectId] });
      qc.invalidateQueries({ queryKey: ["knowledge-sync-status", projectId] });
    },
  });
}

export function useKnowledgeSyncStatus(projectId: string | undefined) {
  return useQuery<KnowledgeSettings>({
    queryKey: ["knowledge-sync-status", projectId],
    queryFn: () => api.get<KnowledgeSettings>(`/api/projects/${projectId}/knowledge/sync-status`),
    enabled: !!projectId,
  });
}

export function useKnowledgeDocs(projectId: string | undefined) {
  return useQuery<KnowledgeDoc[]>({
    queryKey: ["knowledge-docs", projectId],
    queryFn: () => api.get<KnowledgeDoc[]>(`/api/projects/${projectId}/knowledge/documents`),
    enabled: !!projectId,
  });
}

export function useCreateKnowledgeDoc(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: KnowledgeDocCreate) =>
      api.post<KnowledgeDoc>(`/api/projects/${projectId}/knowledge/documents`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["knowledge-docs", projectId] }),
  });
}

export function useUploadKnowledgeDoc(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) =>
      api.upload<KnowledgeDoc>(`/api/projects/${projectId}/knowledge/documents/upload`, formData),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["knowledge-docs", projectId] }),
  });
}

export function useUpdateKnowledgeDoc(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: KnowledgeDocUpdate & { id: string }) =>
      api.patch<KnowledgeDoc>(`/api/knowledge/documents/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["knowledge-docs", projectId] });
      qc.invalidateQueries({ queryKey: ["knowledge-sync-status", projectId] });
    },
  });
}

export function useDeleteKnowledgeDoc(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/knowledge/documents/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["knowledge-docs", projectId] });
      qc.invalidateQueries({ queryKey: ["knowledge-sync-status", projectId] });
    },
  });
}

export function useSyncProjectKnowledge(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<KnowledgeSyncResponse>(`/api/projects/${projectId}/knowledge/sync`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["knowledge-docs", projectId] });
      qc.invalidateQueries({ queryKey: ["knowledge-settings", projectId] });
      qc.invalidateQueries({ queryKey: ["knowledge-sync-status", projectId] });
    },
  });
}
