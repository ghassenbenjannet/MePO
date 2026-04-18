import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ChatComposer } from "../../components/chat/chat-composer";
import { ChatConversationSidebar } from "../../components/chat/chat-conversation-sidebar";
import { ChatDebugPanel } from "../../components/chat/chat-debug-panel";
import { ChatHeader } from "../../components/chat/chat-header";
import { ChatMessageList } from "../../components/chat/chat-message-list";
import type { ChatStarterPrompt, ChatThreadState } from "../../components/chat/chat-ui-types";
import {
  type ChatNodeConversationPreview,
  type ChatNodeMessageDetail,
  type ChatNodeMessagePreview,
  type ChatNodeThread,
  useChatNodeConversations,
  useChatNodeThread,
} from "../../hooks/use-chat-node";
import { useDocuments } from "../../hooks/use-documents";
import { useProjects } from "../../hooks/use-projects";
import { useSpaces } from "../../hooks/use-spaces";
import { useTickets } from "../../hooks/use-tickets";
import { useTopics } from "../../hooks/use-topics";
import { api } from "../../lib/api";
import { featureFlags } from "../../lib/feature-flags";
import { isLegacyEntitySlug, resolveEntityBySlug, spaceChatPath, spaceOverviewPath } from "../../lib/routes";
import { cn } from "../../lib/utils";

type ChatApiResponse = {
  answer_markdown?: string;
  openai_response_id?: string;
  certainty?: Record<string, unknown>;
  related_objects?: Array<{ kind?: string; type?: string; id?: string; label?: string; title?: string }>;
  proposed_actions?: Array<{
    action_id?: string;
    id?: string;
    type?: string;
    label?: string;
    requires_confirmation?: boolean;
    payload?: Record<string, unknown>;
  }>;
};

const EMPTY_CONVERSATIONS: ChatNodeConversationPreview[] = [];
const EMPTY_TOPICS: { id?: string }[] = [];
const EMPTY_TICKETS: { id?: string }[] = [];
const EMPTY_DOCUMENTS: { id?: string }[] = [];

function buildConversationHistory(messages: ChatNodeMessagePreview[], details: Record<string, ChatNodeMessageDetail>) {
  return messages.slice(-10).map((message) => {
    const detail = details[message.id];
    const content =
      detail?.role === "assistant"
        ? (detail.rendered_answer ?? detail.full_text)
        : detail?.full_text ?? message.preview_text;
    return { role: message.role, content };
  });
}

function buildAssistantMetadata(data: ChatApiResponse) {
  return {
    answer_markdown: typeof data.answer_markdown === "string" ? data.answer_markdown : "",
    openai_response_id: typeof data.openai_response_id === "string" ? data.openai_response_id : undefined,
    certainty: typeof data.certainty === "object" && data.certainty !== null ? data.certainty : undefined,
    related_objects: Array.isArray(data.related_objects)
      ? data.related_objects
          .map((item) => ({
            kind: String(item.kind ?? item.type ?? "").trim(),
            id: String(item.id ?? "").trim(),
            label: String(item.label ?? item.title ?? "").trim(),
          }))
          .filter((item) => item.kind && item.id && item.label)
          .slice(0, 8)
      : [],
    proposed_actions: Array.isArray(data.proposed_actions)
      ? data.proposed_actions
          .map((item) => ({
            action_id: String(item.action_id ?? item.id ?? "").trim(),
            type: String(item.type ?? "").trim(),
            label: String(item.label ?? "").trim(),
            requires_confirmation: item.requires_confirmation !== false,
            payload: typeof item.payload === "object" && item.payload !== null ? item.payload : {},
          }))
          .filter((item) => item.action_id && item.type && item.label)
          .slice(0, 6)
      : [],
  };
}

function buildAssistantDetail(messageId: string, createdAt: string, data: ChatApiResponse): ChatNodeMessageDetail {
  const metadata = buildAssistantMetadata(data);
  const answer = metadata.answer_markdown ?? "";

  return {
    id: messageId,
    role: "assistant",
    created_at: createdAt,
    full_text: answer,
    rendered_answer: answer,
    certainty: metadata.certainty ?? null,
    related_objects: metadata.related_objects ?? [],
    actions: (metadata.proposed_actions ?? []).map((action) => ({
      id: action.action_id,
      type: action.type,
      label: action.label,
      requires_confirmation: action.requires_confirmation,
      status: action.requires_confirmation ? "confirmation" : "ready",
      target_label:
        typeof action.payload?.target_label === "string"
          ? action.payload.target_label
          : typeof action.payload?.title === "string"
            ? action.payload.title
            : typeof action.payload?.label === "string"
              ? action.payload.label
              : null,
    })),
    debug_available: false,
  };
}

function upsertConversation(conversations: ChatNodeConversationPreview[], nextConversation: ChatNodeConversationPreview) {
  return [nextConversation, ...conversations.filter((conversation) => conversation.id !== nextConversation.id)];
}

function sameConversationList(a: ChatNodeConversationPreview[], b: ChatNodeConversationPreview[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];
    if (!left || !right) return false;
    if (
      left.id !== right.id
      || left.title !== right.title
      || left.last_message_at !== right.last_message_at
      || left.last_assistant_preview !== right.last_assistant_preview
      || left.status !== right.status
      || left.unread_count !== right.unread_count
    ) {
      return false;
    }
  }
  return true;
}

function mergePreviewMessages(incoming: ChatNodeMessagePreview[], current: ChatNodeMessagePreview[]) {
  const map = new Map<string, ChatNodeMessagePreview>();
  [...incoming, ...current].forEach((message) => map.set(message.id, message));
  return [...map.values()].sort((a, b) => {
    const timeDelta = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (timeDelta !== 0) return timeDelta;
    if (a.role !== b.role) return a.role === "user" ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
}

function buildUserMessagePreview(content: string): ChatNodeMessagePreview {
  return {
    id: crypto.randomUUID(),
    role: "user",
    created_at: new Date().toISOString(),
    preview_text: content.length > 240 ? `${content.slice(0, 240).trimEnd()}...` : content,
    is_truncated: content.length > 240,
    has_detail: content.length > 240,
    has_actions: false,
    state: "ready",
  };
}

function buildAssistantMessagePreview(data: ChatApiResponse): ChatNodeMessagePreview {
  const answer = typeof data.answer_markdown === "string" ? data.answer_markdown.trim() : "";
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    created_at: new Date().toISOString(),
    preview_text: answer.length > 1800 ? `${answer.slice(0, 1800).trimEnd()}...` : answer,
    is_truncated: answer.length > 1800,
    has_detail: !!answer,
    has_actions: Array.isArray(data.proposed_actions) && data.proposed_actions.length > 0,
    state: "ready",
  };
}

export function ChatPage() {
  const navigate = useNavigate();
  const { projectSlug, spaceSlug } = useParams<{ projectSlug: string; spaceSlug: string }>();
  const [searchParams] = useSearchParams();
  const debugMode =
    featureFlags.chatDebugPanelsEnabled
    || (featureFlags.chatExplicitDebugAllowed && searchParams.get("debug") === "1");
  const queryClient = useQueryClient();

  const { data: projects = [] } = useProjects();
  const project = useMemo(() => resolveEntityBySlug(projects, projectSlug), [projectSlug, projects]);
  const projectId = project?.id;
  const { data: spaces = [] } = useSpaces(projectId);
  const space = useMemo(() => resolveEntityBySlug(spaces, spaceSlug), [spaceSlug, spaces]);
  const spaceId = space?.id;

  useEffect(() => {
    if (!projectId || !spaceId) return;
    if (!isLegacyEntitySlug(projectSlug) && !isLegacyEntitySlug(spaceSlug)) return;
    navigate(
      spaceChatPath(
        { id: projectId, name: project?.name ?? projectSlug ?? "" },
        { id: spaceId, name: space?.name ?? spaceSlug ?? "" },
      ),
      { replace: true },
    );
  }, [navigate, project?.name, projectId, projectSlug, space?.name, spaceId, spaceSlug]);

  const { data: topics = EMPTY_TOPICS } = useTopics(spaceId);
  const { data: tickets = EMPTY_TICKETS } = useTickets({ spaceId });
  const { data: documents = EMPTY_DOCUMENTS } = useDocuments({ spaceId });

  const conversationsQuery = useChatNodeConversations(spaceId, projectId);
  const conversations = conversationsQuery.data ?? EMPTY_CONVERSATIONS;
  const loadingConversations = conversationsQuery.isLoading;

  const [conversationList, setConversationList] = useState<ChatNodeConversationPreview[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [threadOffset, setThreadOffset] = useState(0);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);
  const [renamingConversationId, setRenamingConversationId] = useState<string | null>(null);
  const [messageDetails, setMessageDetails] = useState<Record<string, ChatNodeMessageDetail>>({});
  const [loadingMessageIds, setLoadingMessageIds] = useState<Set<string>>(new Set());
  const [loadedThreadMessages, setLoadedThreadMessages] = useState<ChatNodeMessagePreview[]>([]);
  const [threadState, setThreadState] = useState<ChatThreadState | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [openDurationMs, setOpenDurationMs] = useState<number | null>(null);
  const [initialRenderMs, setInitialRenderMs] = useState<number | null>(null);
  const [createDurationMs, setCreateDurationMs] = useState<number | null>(null);
  const [sendDurationMs, setSendDurationMs] = useState<number | null>(null);
  const [assistantRenderMs, setAssistantRenderMs] = useState<number | null>(null);

  const composerRef = useRef<HTMLTextAreaElement>(null);
  const threadScrollRef = useRef<HTMLDivElement>(null);
  const threadBottomRef = useRef<HTMLDivElement>(null);
  const openStartRef = useRef<number | null>(null);
  const renderStartRef = useRef<number | null>(null);
  const threadRenderCountRef = useRef(0);
  const lastHydratedConversationIdRef = useRef<string | null>(null);
  const conversationListRef = useRef<ChatNodeConversationPreview[]>(EMPTY_CONVERSATIONS);
  const loadingMessageIdsRef = useRef<Set<string>>(new Set());

  const threadQuery = useChatNodeThread(selectedConversationId, 20, threadOffset);
  threadRenderCountRef.current += 1;

  useEffect(() => {
    if (sameConversationList(conversationListRef.current, conversations)) return;
    conversationListRef.current = conversations;
    setConversationList(conversations);
  }, [conversations]);

  useEffect(() => {
    conversationListRef.current = conversationList;
  }, [conversationList]);

  useEffect(() => {
    if (!selectedConversationId && conversationList.length > 0) {
      setSelectedConversationId(conversationList[0].id);
      setThreadOffset(0);
    }
  }, [conversationList, selectedConversationId]);

  useEffect(() => {
    if (lastHydratedConversationIdRef.current === selectedConversationId) return;
    lastHydratedConversationIdRef.current = selectedConversationId;
    openStartRef.current = performance.now();
    renderStartRef.current = null;
    setOpenDurationMs(null);
    setInitialRenderMs(null);
    setLoadedThreadMessages([]);
    setThreadState(null);
    setMessageDetails({});
    setSendError(null);
    loadingMessageIdsRef.current = new Set();
    setLoadingMessageIds(new Set());
  }, [selectedConversationId]);

  useEffect(() => {
    if (!threadQuery.data) return;
    const page = threadQuery.data;
    setThreadState({
      total: page.total_message_count,
      loaded: page.loaded_message_count,
      hasMore: page.has_more,
      nextOffset: page.next_offset,
    });
    setLoadedThreadMessages((previous) => {
      if (threadOffset === 0 && previous.length === 0) {
        return page.messages;
      }
      return mergePreviewMessages(page.messages, previous);
    });
    if (openStartRef.current != null && openDurationMs == null) {
      setOpenDurationMs(performance.now() - openStartRef.current);
      renderStartRef.current = performance.now();
    }
  }, [openDurationMs, threadOffset, threadQuery.data]);

  useEffect(() => {
    if (!loadedThreadMessages.length || renderStartRef.current == null || initialRenderMs != null) return;
    const frame = requestAnimationFrame(() => {
      setInitialRenderMs(performance.now() - renderStartRef.current!);
      renderStartRef.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [initialRenderMs, loadedThreadMessages]);

  useEffect(() => {
    if (!sendError) return;
    if (!input.trim()) return;
    setSendError(null);
  }, [input, sendError]);

  const lastMessageId = loadedThreadMessages[loadedThreadMessages.length - 1]?.id;
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      threadBottomRef.current?.scrollIntoView({
        block: "end",
        behavior: selectedConversationId ? "smooth" : "auto",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [lastMessageId, selectedConversationId, sending]);

  const payloadMeasure = useMemo(() => {
    if (!debugMode) {
      return { previewChars: 0, detailChars: 0, largestPreviewChars: 0 };
    }
    const previewChars = loadedThreadMessages.reduce((sum, message) => sum + message.preview_text.length, 0);
    const detailChars = Object.values(messageDetails).reduce((sum, detail) => sum + detail.full_text.length, 0);
    const largestPreviewChars = loadedThreadMessages.reduce((max, message) => Math.max(max, message.preview_text.length), 0);
    return { previewChars, detailChars, largestPreviewChars };
  }, [debugMode, loadedThreadMessages, messageDetails]);

  const focusComposer = useCallback(() => {
    requestAnimationFrame(() => {
      composerRef.current?.focus();
      const length = composerRef.current?.value.length ?? 0;
      composerRef.current?.setSelectionRange(length, length);
    });
  }, []);

  const activeConversation = useMemo(
    () => conversationList.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [conversationList, selectedConversationId],
  );

  const conversationTitle =
    threadQuery.data?.conversation.title
    ?? activeConversation?.title
    ?? (conversationList.length === 0 ? "Discussion IA" : "Selectionnez une discussion");

  const starterPrompts = useMemo<ChatStarterPrompt[]>(() => [
    {
      id: "brief",
      label: "Brief exécutif",
      description: `Résume ${space?.name ?? "cet espace"} à partir des tickets, topics et documents actifs.`,
      prompt: `Prépare un brief exécutif sur ${space?.name ?? "cet espace"} avec priorités, risques, signaux faibles et décisions à prendre.`,
    },
    {
      id: "decision",
      label: "Aide à la décision",
      description: "Structure les options, les compromis et la recommandation la plus actionnable.",
      prompt: `Aide-moi à arbitrer les priorités de ${space?.name ?? "cet espace"} avec une recommandation claire, les compromis et un plan d'action.`,
    },
    {
      id: "plan",
      label: "Plan d'action",
      description: "Transforme le contexte disponible en prochaines étapes concrètes.",
      prompt: `Propose un plan d'action sur 7 jours pour ${space?.name ?? "cet espace"} à partir du contexte disponible.`,
    },
    {
      id: "risks",
      label: "Risques et blocages",
      description: "Isole les sujets sensibles, ce qui manque et ce qu'il faut trancher vite.",
      prompt: `Analyse ${space?.name ?? "cet espace"} et liste les risques, blocages, dépendances et points à confirmer avec un ordre de traitement.`,
    },
  ], [space?.name]);

  const updateConversationCache = useCallback(
    (
      next:
        | ChatNodeConversationPreview[]
        | ((previous: ChatNodeConversationPreview[]) => ChatNodeConversationPreview[]),
    ) => {
      const previous = conversationListRef.current;
      const resolved = typeof next === "function" ? next(previous) : next;
      if (sameConversationList(previous, resolved)) return;
      conversationListRef.current = resolved;
      queryClient.setQueryData(["chat-node", "conversations", spaceId, projectId], resolved);
      setConversationList(resolved);
    },
    [projectId, queryClient, spaceId],
  );

  const createEmptyConversation = useCallback(async () => {
    if (!spaceId || !projectId) return null;
    const startedAt = performance.now();
    setCreatingConversation(true);
    setSendError(null);
    try {
      const created = await api.post<ChatNodeThread>("/api/ai/chat-node/conversations", {
        space_id: spaceId,
        project_id: projectId,
        title: "Nouvelle discussion",
        messages: [],
      });
      updateConversationCache((previous) => upsertConversation(previous, created.conversation));
      queryClient.setQueryData(["chat-node", "thread", created.conversation.id, 20, 0], created);
      lastHydratedConversationIdRef.current = created.conversation.id;
      setSelectedConversationId(created.conversation.id);
      setThreadOffset(0);
      setLoadedThreadMessages(created.messages);
      setThreadState({
        total: created.total_message_count,
        loaded: created.loaded_message_count,
        hasMore: created.has_more,
        nextOffset: created.next_offset,
      });
      setInput("");
      setCreateDurationMs(performance.now() - startedAt);
      setMobileSidebarOpen(false);
      focusComposer();
      return created;
    } finally {
      setCreatingConversation(false);
    }
  }, [focusComposer, projectId, queryClient, spaceId, updateConversationCache]);

  const openMessageDetail = useCallback(async (messageId: string) => {
    if (!selectedConversationId) return;
    if (messageDetails[messageId]) return;
    if (loadingMessageIdsRef.current.has(messageId)) return;

    loadingMessageIdsRef.current.add(messageId);
    setLoadingMessageIds((previous) => {
      const next = new Set(previous);
      next.add(messageId);
      return next;
    });

    try {
      const detail = await api.get<ChatNodeMessageDetail>(`/api/ai/chat-node/conversations/${selectedConversationId}/messages/${messageId}`);
      setMessageDetails((previous) => ({ ...previous, [messageId]: detail }));
    } finally {
      loadingMessageIdsRef.current.delete(messageId);
      setLoadingMessageIds((previous) => {
        const next = new Set(previous);
        next.delete(messageId);
        return next;
      });
    }
  }, [messageDetails, selectedConversationId]);

  const deleteConversation = useCallback(async (conversationId: string) => {
    if (deletingConversationId) return;
    const confirmed = window.confirm("Supprimer definitivement cette discussion ?");
    if (!confirmed) return;
    setDeletingConversationId(conversationId);
    try {
      await api.delete<void>(`/api/ai/conversations/${conversationId}`);
      queryClient.removeQueries({ queryKey: ["chat-node", "thread", conversationId] });
      updateConversationCache((previous) => {
        const remaining = previous.filter((conversation) => conversation.id !== conversationId);
        if (selectedConversationId === conversationId) {
          setSelectedConversationId(remaining[0]?.id ?? null);
          setThreadOffset(0);
          setLoadedThreadMessages([]);
          setThreadState(null);
          setMessageDetails({});
          setInput("");
          setSendError(null);
        }
        return remaining;
      });
    } finally {
      setDeletingConversationId(null);
    }
  }, [deletingConversationId, queryClient, selectedConversationId, updateConversationCache]);

  const renameConversation = useCallback(async (conversationId: string, title: string) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || renamingConversationId) return false;
    setRenamingConversationId(conversationId);
    try {
      const updated = await api.patch<{ id: string; title: string }>(`/api/ai/conversations/${conversationId}`, {
        title: trimmedTitle,
      });
      updateConversationCache((previous) =>
        previous.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, title: updated.title }
            : conversation,
        ),
      );
      queryClient.setQueriesData(
        { queryKey: ["chat-node", "thread", conversationId] },
        (current: ChatNodeThread | undefined) =>
          current
            ? {
                ...current,
                conversation: {
                  ...current.conversation,
                  title: updated.title,
                },
              }
            : current,
      );
      return true;
    } finally {
      setRenamingConversationId(null);
    }
  }, [queryClient, renamingConversationId, updateConversationCache]);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || !spaceId || !projectId || sending || creatingConversation) return;

    setSendError(null);

    let activeConversationId = selectedConversationId;
    if (!activeConversationId) {
      const created = await createEmptyConversation();
      activeConversationId = created?.conversation.id ?? null;
    }
    if (!activeConversationId) return;

    const history = buildConversationHistory(loadedThreadMessages, messageDetails);
    const userPreview = buildUserMessagePreview(trimmed);
    const userDetail: ChatNodeMessageDetail = {
      id: userPreview.id,
      role: "user",
      created_at: userPreview.created_at,
      full_text: trimmed,
      rendered_answer: null,
      certainty: null,
      related_objects: [],
      actions: [],
      debug_available: false,
    };

    setInput("");
    setLoadedThreadMessages((previous) => [...previous, userPreview]);
    setMessageDetails((previous) => ({ ...previous, [userPreview.id]: userDetail }));
    setThreadState((previous) =>
      previous
        ? { ...previous, total: previous.total + 1, loaded: previous.loaded + 1 }
        : { total: 1, loaded: 1, hasMore: false, nextOffset: null },
    );
    setSending(true);
    const sendStartedAt = performance.now();
    let assistantPreviewId: string | null = null;

    try {
      const data = await api.post<ChatApiResponse>("/api/ai/chat", {
        message: trimmed,
        conversation_id: activeConversationId,
        space_id: spaceId,
        project_id: projectId,
        topic_id: null,
        debug: false,
        conversation_history: history,
        response_style: "balanced",
        detail_level: "normal",
        show_confidence: true,
        show_suggestions: true,
      });

      const assistantPreview = buildAssistantMessagePreview(data);
      const assistantDetail = buildAssistantDetail(assistantPreview.id, assistantPreview.created_at, data);
      assistantPreviewId = assistantPreview.id;

      setLoadedThreadMessages((previous) => [...previous, assistantPreview]);
      setMessageDetails((previous) => ({ ...previous, [assistantPreview.id]: assistantDetail }));
      setThreadState((previous) =>
        previous
          ? { ...previous, total: previous.total + 1, loaded: previous.loaded + 1 }
          : { total: 2, loaded: 2, hasMore: false, nextOffset: null },
      );

      const appendResult = await api.post<{ conversation: ChatNodeConversationPreview; appended_messages: ChatNodeMessagePreview[] }>(
        `/api/ai/chat-node/conversations/${activeConversationId}/messages`,
        {
          messages: [
            { role: "user", content: trimmed, metadata: {} },
            { role: "assistant", content: data.answer_markdown ?? "", metadata: buildAssistantMetadata(data) },
          ],
        },
      );
      const persistedUser = appendResult.appended_messages.find((message) => message.role === "user");
      const persistedAssistant = appendResult.appended_messages.find((message) => message.role === "assistant");
      const persistedMessages = [persistedUser, persistedAssistant].filter(Boolean) as ChatNodeMessagePreview[];
      let mergedMessages: ChatNodeMessagePreview[] = [];

      setLoadedThreadMessages((previous) => {
        const remaining = previous.filter((message) => message.id !== userPreview.id && message.id !== assistantPreview.id);
        mergedMessages = mergePreviewMessages(persistedMessages, remaining);
        return mergedMessages;
      });

      if (mergedMessages.length > 0) {
        queryClient.setQueryData(
          ["chat-node", "thread", activeConversationId, 20, 0],
          (current: ChatNodeThread | undefined) =>
            current
              ? {
                  ...current,
                  conversation: appendResult.conversation,
                  messages: mergedMessages,
                  total_message_count: Math.max(current.total_message_count, mergedMessages.length),
                  loaded_message_count: mergedMessages.length,
                  has_more: current.has_more,
                  next_offset: current.next_offset,
                }
              : current,
        );
      }

      setMessageDetails((previous) => {
        const next = { ...previous };
        if (persistedUser && next[userPreview.id]) {
          next[persistedUser.id] = { ...next[userPreview.id], id: persistedUser.id, created_at: persistedUser.created_at };
          delete next[userPreview.id];
        }
        if (persistedAssistant && next[assistantPreview.id]) {
          next[persistedAssistant.id] = {
            ...next[assistantPreview.id],
            id: persistedAssistant.id,
            created_at: persistedAssistant.created_at,
          };
          delete next[assistantPreview.id];
        }
        return next;
      });

      updateConversationCache((previous) => upsertConversation(previous, appendResult.conversation));
      setSendDurationMs(performance.now() - sendStartedAt);
      const renderStartedAt = performance.now();
      requestAnimationFrame(() => setAssistantRenderMs(performance.now() - renderStartedAt));
      focusComposer();
    } catch {
      setInput(trimmed);
      setLoadedThreadMessages((previous) =>
        previous.filter((message) => message.id !== userPreview.id && message.id !== assistantPreviewId),
      );
      setMessageDetails((previous) => {
        const next = { ...previous };
        delete next[userPreview.id];
        if (assistantPreviewId) {
          delete next[assistantPreviewId];
        }
        return next;
      });
      setThreadState((previous) =>
        previous
          ? {
              ...previous,
              total: Math.max(0, previous.total - (assistantPreviewId ? 2 : 1)),
              loaded: Math.max(0, previous.loaded - (assistantPreviewId ? 2 : 1)),
            }
          : previous,
      );
      setSendError("Le message n'a pas pu être envoyé. Vérifiez la connexion puis relancez l'envoi.");
      focusComposer();
    } finally {
      setSending(false);
    }
  }, [
    createEmptyConversation,
    creatingConversation,
    focusComposer,
    input,
    loadedThreadMessages,
    messageDetails,
    projectId,
    queryClient,
    selectedConversationId,
    sending,
    spaceId,
    updateConversationCache,
  ]);

  const threadStateLabel = threadState ? `${threadState.loaded}/${threadState.total}` : "-";
  const backHref = spaceOverviewPath(
    { id: projectId ?? "", name: projectSlug ?? "" },
    { id: spaceId ?? "", name: space?.name ?? spaceSlug ?? "" },
  );

  return (
    <div className="chat-page">
      <ChatHeader
        backHref={backHref}
        spaceName={space?.name}
        projectName={project?.name}
        conversationTitle={conversationTitle}
        topicsCount={topics.length}
        ticketsCount={tickets.length}
        documentsCount={documents.length}
        loadedMessages={threadState?.loaded ?? loadedThreadMessages.length}
        totalMessages={threadState?.total ?? loadedThreadMessages.length}
        creatingConversation={creatingConversation}
        onCreateConversation={() => startTransition(() => void createEmptyConversation())}
        onToggleSidebar={() => setMobileSidebarOpen(true)}
      />

      <div className={cn("chat-shell", debugMode && "chat-shell-debug")}>
        <div
          className={cn(
            "chat-mobile-backdrop",
            mobileSidebarOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
          )}
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />

        <ChatConversationSidebar
          conversations={conversationList}
          activeConversationId={selectedConversationId}
          loading={loadingConversations}
          error={conversationsQuery.isError}
          creatingConversation={creatingConversation}
          deletingConversationId={deletingConversationId}
          renamingConversationId={renamingConversationId}
          onRetry={() => void conversationsQuery.refetch()}
          onCreateConversation={() => startTransition(() => void createEmptyConversation())}
          onSelectConversation={(id) => startTransition(() => {
            if (selectedConversationId === id) return;
            setSelectedConversationId(id);
            setThreadOffset(0);
            setMobileSidebarOpen(false);
          })}
          onDeleteConversation={deleteConversation}
          onRenameConversation={renameConversation}
          onCloseMobile={() => setMobileSidebarOpen(false)}
          className={cn(
            mobileSidebarOpen ? "translate-x-0 opacity-100" : "-translate-x-[110%] opacity-0 xl:translate-x-0 xl:opacity-100",
          )}
        />

        <section className="chat-main-shell">
          <div className="chat-main-panel">
            <div className="chat-thread-topbar">
              <div>
                <p className="chat-thread-eyebrow">Conversation</p>
                <h2 className="chat-thread-title">{conversationTitle}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="chat-toolbar-pill-subtle">{threadStateLabel} messages</span>
                <span className="chat-toolbar-pill-subtle">{topics.length + tickets.length + documents.length} sources de contexte</span>
                <span className="chat-toolbar-pill-subtle">{space?.name ?? "Espace actif"}</span>
              </div>
            </div>

            <ChatMessageList
              messages={loadedThreadMessages}
              messageDetails={messageDetails}
              loadingMessageIds={loadingMessageIds}
              threadState={threadState}
              isLoadingThread={threadQuery.isLoading}
              isFetchingThread={threadQuery.isFetching}
              threadError={threadQuery.isError && !!selectedConversationId}
              sending={sending}
              onRetryThread={() => void threadQuery.refetch()}
              onOpenMessageDetail={openMessageDetail}
              onLoadMore={() => setThreadOffset((previous) => threadState?.nextOffset ?? previous)}
              starterPrompts={starterPrompts}
              onUseStarterPrompt={(prompt) => {
                setInput(prompt);
                focusComposer();
              }}
              scrollRef={threadScrollRef}
              bottomRef={threadBottomRef}
            />

            <ChatComposer
              value={input}
              loading={sending}
              error={sendError}
              inputRef={composerRef}
              contextCounts={{
                topics: topics.length,
                tickets: tickets.length,
                documents: documents.length,
              }}
              onChange={setInput}
              onSend={() => void sendMessage()}
            />
          </div>
        </section>

        {debugMode ? (
          <ChatDebugPanel
            payloadMeasure={payloadMeasure}
            openDurationMs={openDurationMs}
            initialRenderMs={initialRenderMs}
            createDurationMs={createDurationMs}
            sendDurationMs={sendDurationMs}
            assistantRenderMs={assistantRenderMs}
            threadStateLabel={threadStateLabel}
            renderCount={threadRenderCountRef.current}
          />
        ) : null}
      </div>
    </div>
  );
}
