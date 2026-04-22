import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { ChevronLeft, Plus } from "lucide-react";
import { ChatComposer } from "../../components/chat/chat-composer";
import { ChatConversationSidebar } from "../../components/chat/chat-conversation-sidebar";
import { ChatDebugPanel } from "../../components/chat/chat-debug-panel";
import { ChatMessageList } from "../../components/chat/chat-message-list";
import { ChatUseCaseSelector } from "../../components/chat/chat-use-case-selector";
import type { ChatStarterPrompt, ChatThreadState } from "../../components/chat/chat-ui-types";
import {
  type ChatConversationPreview,
  type ChatMessageDetail,
  type ChatMessagePreview,
  type ChatThread,
  useChatConversations,
  useChatThread,
} from "../../hooks/use-chat-conversations";
import { useDocuments } from "../../hooks/use-documents";
import { useProjects } from "../../hooks/use-projects";
import { useSpaces } from "../../hooks/use-spaces";
import { useTickets } from "../../hooks/use-tickets";
import { useTopics } from "../../hooks/use-topics";
import { api } from "../../lib/api";
import { featureFlags } from "../../lib/feature-flags";
import { isLegacyEntitySlug, resolveEntityBySlug, spaceChatPath, spaceOverviewPath } from "../../lib/routes";
import type { ChatProposedActionCard } from "../../hooks/use-chat-conversations";
import { cn } from "../../lib/utils";

export type UseCase =
  | "analyse"
  | "bogue"
  | "recette"
  | "question_generale"
  | "redaction_besoin"
  | "structuration_sujet";

type ChatTurnResponse = {
  conversation: { id: string; title: string; active_use_case: string | null };
  appended_messages: Array<{ id: string; role: string; preview_text: string; created_at: string }>;
  assistant_detail: {
    answer_markdown: string;
    mode: string;
    understanding: string;
    proposed_actions: Array<{
      action_id?: string;
      id?: string;
      type?: string;
      label?: string;
      requires_confirmation?: boolean;
      payload?: Record<string, unknown>;
    }>;
    related_objects: Array<{ kind?: string; id?: string; label?: string }>;
    next_actions: string[];
    sources_used: Array<{ doc_id: string; title: string; role: string }>;
    evidence_level: string;
    document_backed: boolean;
  };
  turn_meta: {
    use_case: string;
    turn_classification: string;
    provider: string;
    retrieval_used: boolean;
    persisted: boolean;
    snapshot_id: string | null;
    retrieved_docs_count: number;
    retained_docs_count: number;
    evidence_count: number;
    corpus_status: string;
    document_backed: boolean;
    evidence_level: string;
    warning_no_docs: string | null;
  };
};

const EMPTY_CONVERSATIONS: ChatConversationPreview[] = [];
const EMPTY_TOPICS: { id?: string }[] = [];
const EMPTY_TICKETS: { id?: string }[] = [];
const EMPTY_DOCUMENTS: { id?: string }[] = [];

function turnMessageToPreview(
  msg: { id: string; role: string; preview_text: string; created_at: string },
): ChatMessagePreview {
  return {
    id: msg.id,
    role: msg.role as "user" | "assistant",
    created_at: msg.created_at,
    preview_text: msg.preview_text,
    is_truncated: msg.preview_text.endsWith("…"),
    has_detail: true,
    has_actions: false,
    state: "ready",
  };
}

function buildAssistantDetailFromTurn(
  msgId: string,
  createdAt: string,
  detail: ChatTurnResponse["assistant_detail"],
): ChatMessageDetail {
  return {
    id: msgId,
    role: "assistant",
    created_at: createdAt,
    full_text: detail.answer_markdown,
    rendered_answer: detail.answer_markdown,
    certainty: null,
    related_objects: (detail.related_objects ?? [])
      .map((obj) => ({
        kind: String(obj.kind ?? "").trim(),
        id: String(obj.id ?? "").trim(),
        label: String(obj.label ?? "").trim(),
      }))
      .filter((obj) => obj.kind && obj.id && obj.label),
    actions: (detail.proposed_actions ?? [])
      .map((action) => ({
        id: String(action.action_id ?? action.id ?? "").trim(),
        type: String(action.type ?? "").trim(),
        label: String(action.label ?? "").trim(),
        requires_confirmation: action.requires_confirmation !== false,
        status: action.requires_confirmation !== false ? "confirmation" : "ready",
        target_label: null,
      }))
      .filter((action) => action.id && action.type && action.label),
    debug_available: false,
    document_sources: [],
    sources_used: detail.sources_used ?? [],
    evidence_level: detail.evidence_level ?? "none",
    document_backed: detail.document_backed ?? false,
    warning_no_docs: null,
    retrieved_docs_count: 0,
    retained_docs_count: 0,
    evidence_count: 0,
    corpus_status: "not_indexed",
  };
}

function buildConversationPreview(
  id: string,
  title: string,
  activeUseCase: string | null,
  assistantPreviewText: string,
): ChatConversationPreview {
  return {
    id,
    title,
    active_use_case: activeUseCase,
    last_message_at: new Date().toISOString(),
    status: "ready",
    unread_count: 0,
    last_assistant_preview: assistantPreviewText,
  };
}

function buildUserMessagePreview(content: string): ChatMessagePreview {
  const preview = content.length > 240 ? `${content.slice(0, 240).trimEnd()}…` : content;
  return {
    id: crypto.randomUUID(),
    role: "user",
    created_at: new Date().toISOString(),
    preview_text: preview,
    is_truncated: content.length > 240,
    has_detail: content.length > 240,
    has_actions: false,
    state: "ready",
  };
}

function buildAssistantLoadingPreview(): ChatMessagePreview {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    created_at: new Date().toISOString(),
    preview_text: "",
    is_truncated: false,
    has_detail: false,
    has_actions: false,
    state: "loading",
  };
}

function upsertConversation(
  conversations: ChatConversationPreview[],
  next: ChatConversationPreview,
) {
  return [next, ...conversations.filter((c) => c.id !== next.id)];
}

function sameConversationList(a: ChatConversationPreview[], b: ChatConversationPreview[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const l = a[i];
    const r = b[i];
    if (!l || !r) return false;
    if (
      l.id !== r.id ||
      l.title !== r.title ||
      l.active_use_case !== r.active_use_case ||
      l.last_message_at !== r.last_message_at ||
      l.last_assistant_preview !== r.last_assistant_preview
    )
      return false;
  }
  return true;
}

function mergePreviewMessages(
  incoming: ChatMessagePreview[],
  current: ChatMessagePreview[],
) {
  const map = new Map<string, ChatMessagePreview>();
  [...incoming, ...current].forEach((m) => map.set(m.id, m));
  return [...map.values()].sort((a, b) => {
    const t = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (t !== 0) return t;
    if (a.role !== b.role) return a.role === "user" ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
}

export function ChatPage() {
  const navigate = useNavigate();
  const { projectSlug, spaceSlug } = useParams<{ projectSlug: string; spaceSlug: string }>();
  const [searchParams] = useSearchParams();
  const debugMode =
    featureFlags.chatDebugPanelsEnabled ||
    (featureFlags.chatExplicitDebugAllowed && searchParams.get("debug") === "1");
  const queryClient = useQueryClient();

  const { data: projects = [] } = useProjects();
  const project = useMemo(
    () => resolveEntityBySlug(projects, projectSlug),
    [projectSlug, projects],
  );
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

  const conversationsQuery = useChatConversations(spaceId, projectId);
  const conversations = conversationsQuery.data ?? EMPTY_CONVERSATIONS;
  const loadingConversations = conversationsQuery.isLoading;

  const [conversationList, setConversationList] = useState<ChatConversationPreview[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [isNewConversationMode, setIsNewConversationMode] = useState(false);
  const [threadOffset, setThreadOffset] = useState(0);
  const [selectedUseCase, setSelectedUseCase] = useState<UseCase | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);
  const [renamingConversationId, setRenamingConversationId] = useState<string | null>(null);
  const [messageDetails, setMessageDetails] = useState<Record<string, ChatMessageDetail>>({});
  const [loadingMessageIds, setLoadingMessageIds] = useState<Set<string>>(new Set());
  const [loadedThreadMessages, setLoadedThreadMessages] = useState<ChatMessagePreview[]>([]);
  const [threadState, setThreadState] = useState<ChatThreadState | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [openDurationMs, setOpenDurationMs] = useState<number | null>(null);
  const [initialRenderMs, setInitialRenderMs] = useState<number | null>(null);
  const [sendDurationMs, setSendDurationMs] = useState<number | null>(null);
  const [assistantRenderMs, setAssistantRenderMs] = useState<number | null>(null);

  const composerRef = useRef<HTMLTextAreaElement>(null);
  const threadScrollRef = useRef<HTMLDivElement>(null);
  const threadBottomRef = useRef<HTMLDivElement>(null);
  const openStartRef = useRef<number | null>(null);
  const renderStartRef = useRef<number | null>(null);
  const threadRenderCountRef = useRef(0);
  const lastHydratedConversationIdRef = useRef<string | null>(null);
  const conversationListRef = useRef<ChatConversationPreview[]>(EMPTY_CONVERSATIONS);
  const loadingMessageIdsRef = useRef<Set<string>>(new Set());

  const threadQuery = useChatThread(selectedConversationId, 20, threadOffset);
  threadRenderCountRef.current += 1;
  const activeConversation = useMemo(
    () => conversationList.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [conversationList, selectedConversationId],
  );

  useEffect(() => {
    if (sameConversationList(conversationListRef.current, conversations)) return;
    conversationListRef.current = conversations;
    setConversationList(conversations);
  }, [conversations]);

  useEffect(() => {
    conversationListRef.current = conversationList;
  }, [conversationList]);

  useEffect(() => {
    if (isNewConversationMode) return;
    if (!selectedConversationId && conversationList.length > 0) {
      setSelectedConversationId(conversationList[0].id);
      setThreadOffset(0);
    }
  }, [conversationList, isNewConversationMode, selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) return;
    const activeUseCase =
      threadQuery.data?.conversation.active_use_case ?? activeConversation?.active_use_case ?? null;
    if (activeUseCase) {
      setSelectedUseCase(activeUseCase as UseCase);
    }
  }, [
    activeConversation?.active_use_case,
    selectedConversationId,
    threadQuery.data?.conversation.active_use_case,
  ]);

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
    setLoadedThreadMessages((prev) => {
      if (threadOffset === 0 && prev.length === 0) return page.messages;
      return mergePreviewMessages(page.messages, prev);
    });
    if (openStartRef.current != null && openDurationMs == null) {
      setOpenDurationMs(performance.now() - openStartRef.current);
      renderStartRef.current = performance.now();
    }
  }, [openDurationMs, threadOffset, threadQuery.data]);

  useEffect(() => {
    if (!loadedThreadMessages.length || renderStartRef.current == null || initialRenderMs != null)
      return;
    const frame = requestAnimationFrame(() => {
      setInitialRenderMs(performance.now() - renderStartRef.current!);
      renderStartRef.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [initialRenderMs, loadedThreadMessages]);

  useEffect(() => {
    if (!sendError || !input.trim()) return;
    setSendError(null);
  }, [input, sendError]);

  const lastMessageId = loadedThreadMessages[loadedThreadMessages.length - 1]?.id;
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      threadBottomRef.current?.scrollIntoView({ block: "end", behavior: selectedConversationId ? "smooth" : "auto" });
    });
    return () => cancelAnimationFrame(frame);
  }, [lastMessageId, selectedConversationId, sending]);

  const payloadMeasure = useMemo(() => {
    if (!debugMode) return { previewChars: 0, detailChars: 0, largestPreviewChars: 0 };
    const previewChars = loadedThreadMessages.reduce((s, m) => s + m.preview_text.length, 0);
    const detailChars = Object.values(messageDetails).reduce((s, d) => s + d.full_text.length, 0);
    const largestPreviewChars = loadedThreadMessages.reduce(
      (max, m) => Math.max(max, m.preview_text.length),
      0,
    );
    return { previewChars, detailChars, largestPreviewChars };
  }, [debugMode, loadedThreadMessages, messageDetails]);

  const focusComposer = useCallback(() => {
    requestAnimationFrame(() => {
      composerRef.current?.focus();
      const length = composerRef.current?.value.length ?? 0;
      composerRef.current?.setSelectionRange(length, length);
    });
  }, []);

  const conversationTitle =
    threadQuery.data?.conversation.title ??
    activeConversation?.title ??
    (conversationList.length === 0 ? "Discussion IA" : "Sélectionnez une discussion");

  const starterPrompts = useMemo<ChatStarterPrompt[]>(
    () => [
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
    ],
    [space?.name],
  );

  const updateConversationCache = useCallback(
    (
      next:
        | ChatConversationPreview[]
        | ((prev: ChatConversationPreview[]) => ChatConversationPreview[]),
    ) => {
      const prev = conversationListRef.current;
      const resolved = typeof next === "function" ? next(prev) : next;
      if (sameConversationList(prev, resolved)) return;
      conversationListRef.current = resolved;
      queryClient.setQueryData(["chat", "conversations", spaceId, projectId], resolved);
      setConversationList(resolved);
    },
    [projectId, queryClient, spaceId],
  );

  const openMessageDetail = useCallback(
    async (messageId: string) => {
      if (!selectedConversationId) return;
      if (messageDetails[messageId]) return;
      if (loadingMessageIdsRef.current.has(messageId)) return;

      loadingMessageIdsRef.current.add(messageId);
      setLoadingMessageIds((prev) => {
        const next = new Set(prev);
        next.add(messageId);
        return next;
      });

      try {
        const detail = await api.get<ChatMessageDetail>(
          `/api/ai/conversations/${selectedConversationId}/messages/${messageId}`,
        );
        setMessageDetails((prev) => ({ ...prev, [messageId]: detail }));
      } finally {
        loadingMessageIdsRef.current.delete(messageId);
        setLoadingMessageIds((prev) => {
          const next = new Set(prev);
          next.delete(messageId);
          return next;
        });
      }
    },
    [messageDetails, selectedConversationId],
  );

  const deleteConversation = useCallback(
    async (conversationId: string) => {
      if (deletingConversationId) return;
      const confirmed = window.confirm("Supprimer définitivement cette discussion ?");
      if (!confirmed) return;
      setDeletingConversationId(conversationId);
      try {
        await api.delete<void>(`/api/ai/conversations/${conversationId}`);
        queryClient.removeQueries({ queryKey: ["chat", "thread", conversationId] });
        updateConversationCache((prev) => {
          const remaining = prev.filter((c) => c.id !== conversationId);
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
    },
    [deletingConversationId, queryClient, selectedConversationId, updateConversationCache],
  );

  const renameConversation = useCallback(
    async (conversationId: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed || renamingConversationId) return false;
      setRenamingConversationId(conversationId);
      try {
        const updated = await api.patch<{ id: string; title: string }>(
          `/api/ai/conversations/${conversationId}`,
          { title: trimmed },
        );
        updateConversationCache((prev) =>
          prev.map((c) => (c.id === conversationId ? { ...c, title: updated.title } : c)),
        );
        queryClient.setQueriesData(
          { queryKey: ["chat", "thread", conversationId] },
          (current: ChatThread | undefined) =>
            current
              ? { ...current, conversation: { ...current.conversation, title: updated.title } }
              : current,
        );
        return true;
      } finally {
        setRenamingConversationId(null);
      }
    },
    [queryClient, renamingConversationId, updateConversationCache],
  );

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || !spaceId || !projectId || sending || !selectedUseCase) return;

    setSendError(null);

    const userPreview = buildUserMessagePreview(trimmed);
    const assistantLoading = buildAssistantLoadingPreview();

    setInput("");
    setLoadedThreadMessages((prev) => [...prev, userPreview, assistantLoading]);
    setThreadState((prev) =>
      prev
        ? { ...prev, total: prev.total + 2, loaded: prev.loaded + 2 }
        : { total: 2, loaded: 2, hasMore: false, nextOffset: null },
    );
    setSending(true);
    const sendStartedAt = performance.now();

    try {
      const result = await api.post<ChatTurnResponse>("/api/ai/conversations/turns", {
        message: trimmed,
        use_case: selectedUseCase,
        space_id: spaceId,
        project_id: projectId,
        topic_id: null,
        conversation_id: selectedConversationId,
      });

      const persistedMessages = result.appended_messages.map(turnMessageToPreview);
      const persistedUser = persistedMessages.find((m) => m.role === "user");
      const persistedAssistant = persistedMessages.find((m) => m.role === "assistant");

      setLoadedThreadMessages((prev) => {
        const remaining = prev.filter(
          (m) => m.id !== userPreview.id && m.id !== assistantLoading.id,
        );
        return mergePreviewMessages(persistedMessages, remaining);
      });

      if (persistedAssistant) {
        const assistantDetail = {
          ...buildAssistantDetailFromTurn(
            persistedAssistant.id,
            persistedAssistant.created_at,
            result.assistant_detail,
          ),
          warning_no_docs: result.turn_meta.warning_no_docs ?? null,
          retrieved_docs_count: result.turn_meta.retrieved_docs_count ?? 0,
          retained_docs_count: result.turn_meta.retained_docs_count ?? 0,
          evidence_count: result.turn_meta.evidence_count ?? 0,
          corpus_status: result.turn_meta.corpus_status ?? "not_indexed",
        };
        setMessageDetails((prev) => ({
          ...prev,
          [persistedAssistant.id]: assistantDetail,
          ...(persistedUser ? { [persistedUser.id]: {
            id: persistedUser.id,
            role: "user",
            created_at: persistedUser.created_at,
            full_text: trimmed,
            rendered_answer: null,
            certainty: null,
            related_objects: [],
            actions: [],
            debug_available: false,
            document_sources: [],
            sources_used: [],
            evidence_level: "none",
            document_backed: false,
            warning_no_docs: null,
          } } : {}),
        }));
      }

      const conversationPreview = buildConversationPreview(
        result.conversation.id,
        result.conversation.title,
        result.conversation.active_use_case,
        result.assistant_detail.answer_markdown.slice(0, 200),
      );

      if (!selectedConversationId) {
        lastHydratedConversationIdRef.current = result.conversation.id;
        setIsNewConversationMode(false);
        setSelectedConversationId(result.conversation.id);
        setThreadOffset(0);
      }

      updateConversationCache((prev) => upsertConversation(prev, conversationPreview));
      queryClient.invalidateQueries({ queryKey: ["chat", "conversations", spaceId, projectId] });

      setSendDurationMs(performance.now() - sendStartedAt);
      requestAnimationFrame(() => setAssistantRenderMs(performance.now() - sendStartedAt));
      focusComposer();
    } catch {
      setInput(trimmed);
      setLoadedThreadMessages((prev) =>
        prev.filter((m) => m.id !== userPreview.id && m.id !== assistantLoading.id),
      );
      setThreadState((prev) =>
        prev
          ? { ...prev, total: Math.max(0, prev.total - 2), loaded: Math.max(0, prev.loaded - 2) }
          : prev,
      );
      setSendError("Le message n'a pas pu être envoyé. Vérifiez la connexion puis relancez l'envoi.");
      focusComposer();
    } finally {
      setSending(false);
    }
  }, [
    focusComposer,
    input,
    projectId,
    queryClient,
    selectedConversationId,
    selectedUseCase,
    sending,
    spaceId,
    updateConversationCache,
  ]);

  const handleStartConversation = useCallback(() => {
    setIsNewConversationMode(true);
    setSelectedConversationId(null);
    setLoadedThreadMessages([]);
    setThreadState(null);
    setMessageDetails({});
    setInput("");
    setSendError(null);
    lastHydratedConversationIdRef.current = null;
    setSelectedUseCase(null);
    setMobileSidebarOpen(false);
  }, []);

  const threadStateLabel = threadState ? `${threadState.loaded}/${threadState.total}` : "-";
  const backHref = spaceOverviewPath(
    { id: projectId ?? "", name: projectSlug ?? "" },
    { id: spaceId ?? "", name: space?.name ?? spaceSlug ?? "" },
  );

  const handleActionClick = useCallback((action: ChatProposedActionCard) => {
    const baseSuivi = spaceOverviewPath(
      { id: projectId ?? "", name: projectSlug ?? "" },
      { id: spaceId ?? "", name: space?.name ?? spaceSlug ?? "" },
    );
    const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
    if (action.type === "create_ticket") {
      navigate(`${baseSuivi}?view=kanban&create=ticket&returnTo=${returnTo}`);
    } else if (action.type === "create_topic") {
      navigate(`${baseSuivi}?view=topics&create=topic&returnTo=${returnTo}`);
    } else if (action.type === "create_document") {
      navigate(`${baseSuivi.replace("/suivi", "/documents")}`);
    }
  }, [navigate, projectId, projectSlug, spaceId, space?.name, spaceSlug]);
  const isNewConversation = !selectedConversationId && loadedThreadMessages.length === 0;

  const lastAssistantDetail = useMemo(() => {
    const last = [...loadedThreadMessages].reverse().find((m) => m.role === "assistant");
    return last ? messageDetails[last.id] : null;
  }, [loadedThreadMessages, messageDetails]);

  const contextTotal = topics.length + tickets.length + documents.length;

  return (
    <div className="chat-page">
      {/* Thin topbar */}
      <div className="chat-topbar">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="chat-mobile-only chat-icon-button"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Ouvrir les conversations"
          >
            <span className="text-[var(--ink-4)] text-sm">☰</span>
          </button>
          <Link to={backHref} className="chat-topbar-back">
            <ChevronLeft className="h-3.5 w-3.5" />
            {space?.name ?? "Espace"}
          </Link>
          {selectedUseCase && (
            <button
              type="button"
              className="chat-toolbar-pill-subtle"
              onClick={() => setSelectedUseCase(null)}
              title="Changer de cas métier"
            >
              {selectedUseCase.replace(/_/g, " ")} ×
            </button>
          )}
        </div>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg border border-[var(--rule)] bg-[var(--paper-2)] px-3 py-1.5 text-[12px] font-semibold text-[var(--ink-3)] hover:border-[var(--ink-4)] transition-colors"
          onClick={() => startTransition(handleStartConversation)}
        >
          <Plus className="h-3.5 w-3.5" />
          Nouvelle discussion
        </button>
      </div>

      {/* 3-column grid */}
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
          creatingConversation={false}
          deletingConversationId={deletingConversationId}
          renamingConversationId={renamingConversationId}
          onRetry={() => void conversationsQuery.refetch()}
          onCreateConversation={() => startTransition(handleStartConversation)}
          onSelectConversation={(id) =>
            startTransition(() => {
              if (selectedConversationId === id) return;
              setSelectedConversationId(id);
              setThreadOffset(0);
              setMobileSidebarOpen(false);
            })
          }
          onDeleteConversation={deleteConversation}
          onRenameConversation={renameConversation}
          onCloseMobile={() => setMobileSidebarOpen(false)}
          className={cn(
            mobileSidebarOpen
              ? "translate-x-0 opacity-100"
              : "-translate-x-[110%] opacity-0 xl:translate-x-0 xl:opacity-100",
          )}
        />

        <section className="chat-main-shell">
          <div className="chat-main-panel">
            <div className="chat-thread-topbar">
              <div>
                <p className="chat-thread-eyebrow">Fil actif</p>
                <h2 className="chat-thread-title">{conversationTitle}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="chat-toolbar-pill-subtle">{threadStateLabel} msg</span>
                <span className="chat-toolbar-pill-subtle">{contextTotal} sources</span>
              </div>
            </div>

            {isNewConversation && !selectedUseCase ? (
              <ChatUseCaseSelector onSelect={setSelectedUseCase} />
            ) : (
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
                onActionClick={handleActionClick}
                onLoadMore={() =>
                  setThreadOffset((prev) => threadState?.nextOffset ?? prev)
                }
                starterPrompts={starterPrompts}
                onUseStarterPrompt={(prompt) => {
                  setInput(prompt);
                  focusComposer();
                }}
                scrollRef={threadScrollRef}
                bottomRef={threadBottomRef}
              />
            )}

            {(selectedUseCase || !isNewConversation) && (
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
            )}
          </div>
        </section>

        {/* Right context panel */}
        <aside className="chat-context-panel hidden xl:block 2xl:block">
          <div className="chat-context-section">
            <span className="chat-context-eyebrow">Espace</span>
            <p className="text-[13px] font-semibold text-[var(--ink)]">{space?.name ?? "—"}</p>
            <p className="text-[11px] text-[var(--ink-4)] mt-0.5">{project?.name}</p>
            {selectedUseCase && (
              <p className="mt-1.5 text-[11px] font-mono tracking-wider uppercase text-[var(--ink-4)]">
                {selectedUseCase.replace(/_/g, " ")}
              </p>
            )}
            {contextTotal > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {topics.length > 0 && <span className="chat-toolbar-pill-subtle">{topics.length} topics</span>}
                {tickets.length > 0 && <span className="chat-toolbar-pill-subtle">{tickets.length} tickets</span>}
                {documents.length > 0 && <span className="chat-toolbar-pill-subtle">{documents.length} docs</span>}
              </div>
            )}
          </div>

          {lastAssistantDetail?.sources_used?.length ? (
            <div className="chat-context-section">
              <span className="chat-context-eyebrow">Sources · dernier message</span>
              <div className="flex flex-col gap-1.5 mt-1">
                {lastAssistantDetail.sources_used.map((src) => (
                  <div key={src.doc_id} className="flex items-start gap-1.5">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[var(--accent)] flex-shrink-0" />
                    <span className="text-[12px] text-[var(--ink-2)] leading-snug">{src.title}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {lastAssistantDetail?.actions?.length ? (
            <div className="chat-context-section">
              <span className="chat-context-eyebrow">Actions proposées</span>
              <div className="flex flex-col gap-1.5 mt-1">
                {lastAssistantDetail.actions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    className="chat-context-action-item"
                    onClick={() => handleActionClick(action)}
                  >
                    <p className="text-[12px] font-semibold text-[var(--ink)] leading-snug">{action.label}</p>
                    <p className="text-[10.5px] text-[var(--ink-4)] mt-0.5">{action.type.replace(/_/g, " ")}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {!lastAssistantDetail && (
            <div className="text-[11.5px] text-[var(--ink-5)] leading-relaxed">
              Le contexte de la dernière réponse apparaîtra ici — sources, preuves et actions.
            </div>
          )}
        </aside>

        {debugMode ? (
          <ChatDebugPanel
            payloadMeasure={payloadMeasure}
            openDurationMs={openDurationMs}
            initialRenderMs={initialRenderMs}
            createDurationMs={null}
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
