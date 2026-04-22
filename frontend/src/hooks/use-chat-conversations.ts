import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export interface ChatConversationPreview {
  id: string;
  title: string;
  active_use_case: string | null;
  last_message_at: string;
  status: string;
  unread_count: number;
  last_assistant_preview: string;
}

export interface ChatProposedActionCard {
  id: string;
  type: string;
  label: string;
  requires_confirmation: boolean;
  status: string;
  target_label: string | null;
}

export interface ChatMessagePreview {
  id: string;
  role: "user" | "assistant";
  created_at: string;
  preview_text: string;
  is_truncated: boolean;
  has_detail: boolean;
  has_actions: boolean;
  state: string;
}

export interface ChatDocumentSource {
  id: string;
  title: string;
  category: string | null;
}

export interface ChatSourceUsed {
  doc_id: string;
  title: string;
  role: string;
}

export interface ChatMessageDetail {
  id: string;
  role: "user" | "assistant";
  created_at: string;
  full_text: string;
  rendered_answer: string | null;
  certainty: Record<string, unknown> | null;
  related_objects: Array<{ kind: string; id: string; label: string }>;
  actions: ChatProposedActionCard[];
  debug_available: boolean;
  document_sources: ChatDocumentSource[];
  sources_used: ChatSourceUsed[];
  evidence_level: string;
  document_backed: boolean;
  warning_no_docs: string | null;
  retrieved_docs_count: number;
  retained_docs_count: number;
  evidence_count: number;
  corpus_status: string;
}

export interface ChatThread {
  conversation: ChatConversationPreview;
  messages: ChatMessagePreview[];
  total_message_count: number;
  loaded_message_count: number;
  has_more: boolean;
  next_offset: number | null;
}

export function useChatConversations(spaceId?: string, projectId?: string) {
  const params = new URLSearchParams();
  if (spaceId) params.set("space_id", spaceId);
  else if (projectId) params.set("project_id", projectId);
  const qs = params.toString() ? `?${params}` : "";

  return useQuery<ChatConversationPreview[]>({
    queryKey: ["chat", "conversations", spaceId, projectId],
    queryFn: () => api.get<ChatConversationPreview[]>(`/api/ai/conversations${qs}`),
    enabled: !!(spaceId || projectId),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useChatThread(conversationId: string | null, limit: number = 20, offset: number = 0) {
  return useQuery<ChatThread>({
    queryKey: ["chat", "thread", conversationId, limit, offset],
    queryFn: () =>
      api.get<ChatThread>(
        `/api/ai/conversations/${conversationId}?limit=${limit}&offset=${offset}`,
      ),
    enabled: !!conversationId,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
