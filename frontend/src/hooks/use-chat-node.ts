import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export interface ChatNodeConversationPreview {
  id: string;
  title: string;
  last_message_at: string;
  status: string;
  unread_count: number;
  last_assistant_preview: string;
}

export interface ChatNodeProposedActionCard {
  id: string;
  type: string;
  label: string;
  requires_confirmation: boolean;
  status: string;
  target_label: string | null;
}

export interface ChatNodeMessagePreview {
  id: string;
  role: "user" | "assistant";
  created_at: string;
  preview_text: string;
  is_truncated: boolean;
  has_detail: boolean;
  has_actions: boolean;
  state: string;
}

export interface ChatNodeMessageDetail {
  id: string;
  role: "user" | "assistant";
  created_at: string;
  full_text: string;
  rendered_answer: string | null;
  certainty: Record<string, unknown> | null;
  related_objects: Array<{ kind: string; id: string; label: string }>;
  actions: ChatNodeProposedActionCard[];
  debug_available: boolean;
}

export interface ChatNodeThread {
  conversation: ChatNodeConversationPreview;
  messages: ChatNodeMessagePreview[];
  total_message_count: number;
  loaded_message_count: number;
  has_more: boolean;
  next_offset: number | null;
}

export function useChatNodeConversations(spaceId?: string, projectId?: string) {
  const params = new URLSearchParams();
  if (spaceId) params.set("space_id", spaceId);
  else if (projectId) params.set("project_id", projectId);
  const qs = params.toString() ? `?${params}` : "";

  return useQuery<ChatNodeConversationPreview[]>({
    queryKey: ["chat-node", "conversations", spaceId, projectId],
    queryFn: () => api.get<ChatNodeConversationPreview[]>(`/api/ai/chat-node/conversations${qs}`),
    enabled: !!(spaceId || projectId),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useChatNodeThread(convId: string | null, limit: number = 20, offset: number = 0) {
  return useQuery<ChatNodeThread>({
    queryKey: ["chat-node", "thread", convId, limit, offset],
    queryFn: () => api.get<ChatNodeThread>(`/api/ai/chat-node/conversations/${convId}?limit=${limit}&offset=${offset}`),
    enabled: !!convId,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
