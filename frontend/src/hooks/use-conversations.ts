import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  space_id: string;
  project_id: string | null;
  topic_id: string | null;
  message_count: number;
  created_at: string;
  updated_at: string | null;
}

export interface ConversationDetail extends ConversationSummary {
  messages: ConversationMessage[];
  total_message_count: number;
  loaded_message_count: number;
  has_more: boolean;
  next_offset: number | null;
}

export interface ConversationCreate {
  space_id: string;
  project_id?: string;
  topic_id?: string;
  title?: string;
  messages?: Array<{ role: string; content: string; metadata?: Record<string, unknown> }>;
}

export interface ConversationAppend {
  messages: Array<{ role: string; content: string; metadata?: Record<string, unknown> }>;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useConversations(spaceId?: string, projectId?: string) {
  const params = new URLSearchParams();
  if (spaceId) params.set("space_id", spaceId);
  else if (projectId) params.set("project_id", projectId);
  const qs = params.toString() ? `?${params}` : "";

  return useQuery<ConversationSummary[]>({
    queryKey: ["conversations", spaceId, projectId],
    queryFn: () => api.get<ConversationSummary[]>(`/api/ai/conversations${qs}`),
    enabled: !!(spaceId || projectId),
    staleTime: 30_000,
  });
}

export function useConversation(convId: string | null) {
  return useQuery<ConversationDetail>({
    queryKey: ["conversations", "detail", convId],
    queryFn: () => api.get<ConversationDetail>(`/api/ai/conversations/${convId}`),
    enabled: !!convId,
  });
}

export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ConversationCreate) =>
      api.post<ConversationDetail>("/api/ai/conversations", data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["conversations", data.space_id] });
    },
  });
}

export function useAppendMessages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ convId, messages }: { convId: string; messages: ConversationAppend["messages"] }) =>
      api.post<ConversationDetail>(`/api/ai/conversations/${convId}/messages`, { messages }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["conversations", data.space_id] });
      qc.setQueryData(["conversations", "detail", data.id], data);
    },
  });
}

export function useRenameConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ convId, title }: { convId: string; title: string }) =>
      api.patch<ConversationSummary>(`/api/ai/conversations/${convId}`, { title }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["conversations", data.space_id] });
    },
  });
}

export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (convId: string) =>
      api.delete(`/api/ai/conversations/${convId}`),
    onSuccess: (_data, convId) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.removeQueries({ queryKey: ["conversations", "detail", convId] });
    },
  });
}
