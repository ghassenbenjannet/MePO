import { memo, useCallback, useMemo, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { Check, ChevronDown, Clock3, Copy, Loader2, RefreshCcw, Sparkles } from "lucide-react";
import type { ChatNodeMessageDetail, ChatNodeMessagePreview, ChatNodeProposedActionCard } from "../../hooks/use-chat-node";
import { Button } from "../ui/button";
import { RowSkeleton } from "../ui/skeleton";
import { cn } from "../../lib/utils";
import { ChatMarkdown } from "./chat-markdown";
import type { ChatStarterPrompt, ChatThreadState } from "./chat-ui-types";

type ChatMessageListProps = {
  messages: ChatNodeMessagePreview[];
  messageDetails: Record<string, ChatNodeMessageDetail>;
  loadingMessageIds: Set<string>;
  threadState: ChatThreadState | null;
  isLoadingThread: boolean;
  isFetchingThread: boolean;
  threadError: boolean;
  sending: boolean;
  onRetryThread: () => void;
  onOpenMessageDetail: (id: string) => void;
  onLoadMore: () => void;
  starterPrompts: ChatStarterPrompt[];
  onUseStarterPrompt: (prompt: string) => void;
  scrollRef: RefObject<HTMLDivElement>;
  bottomRef: RefObject<HTMLDivElement>;
};

function buildBody(message: ChatNodeMessagePreview, detail?: ChatNodeMessageDetail) {
  if (!detail) return message.preview_text;
  return message.role === "assistant" ? (detail.rendered_answer ?? detail.full_text) : detail.full_text;
}

function buildCopyValue(message: ChatNodeMessagePreview, detail?: ChatNodeMessageDetail) {
  return detail?.full_text || detail?.rendered_answer || message.preview_text;
}

function buildAssistantSummary(detail?: ChatNodeMessageDetail) {
  if (!detail) return null;
  const parts = [
    detail.related_objects.length > 0 ? `${detail.related_objects.length} référence${detail.related_objects.length > 1 ? "s" : ""}` : null,
    detail.actions.length > 0 ? `${detail.actions.length} action${detail.actions.length > 1 ? "s" : ""}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" • ") : null;
}

function MessageUtilityButton({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="chat-inline-action"
    >
      {icon}
      {label}
    </button>
  );
}

const ActionBadge = memo(function ActionBadge({ action }: { action: ChatNodeProposedActionCard }) {
  return (
    <div className="chat-action-card">
      <p className="text-xs font-semibold text-[var(--text-strong)]">{action.label}</p>
      <p className="mt-1 text-[11px] text-[var(--text-muted)]">
        {action.type}
        {action.target_label ? ` · ${action.target_label}` : ""}
        {action.requires_confirmation ? " · confirmation" : ""}
      </p>
    </div>
  );
});

function RelatedObjectCard({ item }: { item: { kind: string; id: string; label: string } }) {
  return (
    <div className="chat-reference-card">
      <span className="chat-reference-kind">{item.kind}</span>
      <p className="mt-2 line-clamp-2 text-sm font-semibold text-[var(--text-strong)]">{item.label}</p>
      <p className="mt-1 truncate text-[11px] text-[var(--text-muted)]">{item.id}</p>
    </div>
  );
}

const ThreadMessageCard = memo(function ThreadMessageCard({
  message,
  detail,
  loading,
  onOpen,
}: {
  message: ChatNodeMessagePreview;
  detail?: ChatNodeMessageDetail;
  loading: boolean;
  onOpen: (id: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const isAssistant = message.role === "assistant";
  const body = useMemo(() => buildBody(message, detail), [detail, message]);
  const assistantSummary = useMemo(() => buildAssistantSummary(detail), [detail]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(buildCopyValue(message, detail));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }, [detail, message]);

  return (
    <article
      className={cn(
        "chat-message-row",
        isAssistant ? "chat-message-row-assistant" : "chat-message-row-user",
      )}
      style={{ contentVisibility: "auto", containIntrinsicSize: isAssistant ? "520px" : "220px" }}
    >
      <div className={cn("chat-bubble", isAssistant ? "chat-bubble-assistant" : "chat-bubble-user")}>
        <div className="chat-message-head">
          <div className="flex min-w-0 items-center gap-3">
            <span className={cn("chat-avatar", isAssistant ? "chat-avatar-assistant" : "chat-avatar-user")}>
              {isAssistant ? "AI" : "VOUS"}
            </span>
            <div className="min-w-0">
              <p className={cn("truncate text-sm font-semibold", isAssistant ? "text-[var(--text-strong)]" : "text-white")}>
                {isAssistant ? "Assistant Shadow" : "Vous"}
              </p>
              <p className={cn("text-[11px]", isAssistant ? "text-[var(--text-muted)]" : "text-white/80")}>
                {new Date(message.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <MessageUtilityButton
              label={copied ? "Copié" : "Copier"}
              icon={copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              onClick={() => void handleCopy()}
            />
            {(message.is_truncated || (message.has_detail && !detail)) ? (
              <MessageUtilityButton
                label={loading ? "Chargement..." : "Déplier"}
                icon={loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronDown className="h-3.5 w-3.5" />}
                onClick={() => onOpen(message.id)}
                disabled={loading}
              />
            ) : null}
          </div>
        </div>

        {isAssistant ? (
          <div className="mt-4 space-y-4">
            <div className="chat-response-section chat-response-section-intro">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="chat-section-chip">Synthèse</span>
                <p className="text-xs text-[var(--text-muted)]">
                  {assistantSummary ?? "Réponse structurée à partir du contexte disponible."}
                </p>
              </div>
              <ChatMarkdown content={body} />
            </div>
          </div>
        ) : (
          <div className="mt-4 text-white">
            <div className="chat-user-message-body">{body}</div>
          </div>
        )}

        {detail?.related_objects.length ? (
          <div className="mt-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="chat-section-chip">Références</span>
              <p className="text-xs text-[var(--text-muted)]">Objets reliés à cette réponse</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {detail.related_objects.map((item) => (
                <RelatedObjectCard key={`${item.kind}-${item.id}`} item={item} />
              ))}
            </div>
          </div>
        ) : null}

        {detail?.actions.length ? (
          <div className="mt-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="chat-section-chip">Actions</span>
              <p className="text-xs text-[var(--text-muted)]">Pistes proposées pour aller plus vite.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {detail.actions.map((action) => (
                <ActionBadge key={action.id} action={action} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
});

function StreamingMessage() {
  return (
    <div className="chat-message-row chat-message-row-assistant">
      <div className="chat-bubble chat-bubble-assistant">
        <div className="chat-message-head">
          <div className="flex items-center gap-3">
            <span className="chat-avatar chat-avatar-assistant">AI</span>
            <div>
              <p className="text-sm font-semibold text-[var(--text-strong)]">Assistant Shadow</p>
              <p className="text-[11px] text-[var(--text-muted)]">Génération en cours</p>
            </div>
          </div>
          <span className="chat-toolbar-pill-subtle">Streaming prêt</span>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <span className="thinking-dot chat-thinking-dot" />
          <span className="thinking-dot chat-thinking-dot" />
          <span className="thinking-dot chat-thinking-dot" />
          <p className="text-sm text-[var(--text-muted)]">L'assistant structure sa réponse...</p>
        </div>
      </div>
    </div>
  );
}

function EmptyThreadState({
  starterPrompts,
  onUseStarterPrompt,
}: {
  starterPrompts: ChatStarterPrompt[];
  onUseStarterPrompt: (prompt: string) => void;
}) {
  return (
    <div className="chat-empty-card">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand-light)] text-[var(--brand)]">
        <Sparkles className="h-6 w-6" />
      </div>
      <p className="mt-4 text-lg font-semibold text-[var(--text-strong)]">Démarrez une conversation utile dès le premier message</p>
      <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--text-muted)]">
        Le thread est conçu pour alterner lecture rapide et approfondissement: sections claires, code lisible, références visibles et actions récupérables.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {starterPrompts.map((prompt) => (
          <button
            key={prompt.id}
            type="button"
            onClick={() => onUseStarterPrompt(prompt.prompt)}
            className="chat-prompt-card"
          >
            <p className="text-sm font-semibold text-[var(--text-strong)]">{prompt.label}</p>
            <p className="mt-2 text-xs leading-6 text-[var(--text-muted)]">{prompt.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ChatMessageList({
  messages,
  messageDetails,
  loadingMessageIds,
  threadState,
  isLoadingThread,
  isFetchingThread,
  threadError,
  sending,
  onRetryThread,
  onOpenMessageDetail,
  onLoadMore,
  starterPrompts,
  onUseStarterPrompt,
  scrollRef,
  bottomRef,
}: ChatMessageListProps) {
  return (
    <div ref={scrollRef} className="chat-thread-scroll">
      <div className="chat-thread-reading-column">
        {threadError && messages.length === 0 ? (
          <div className="chat-empty-card">
            <p className="font-semibold text-[var(--text-strong)]">Le thread n'a pas pu être chargé</p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Retentez la récupération pour recharger les messages et le contexte associé.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onRetryThread}
              leadingIcon={<RefreshCcw className="h-3.5 w-3.5" />}
              className="mt-4"
            >
              Recharger le fil
            </Button>
          </div>
        ) : null}

        {isLoadingThread && messages.length === 0 ? (
          <div className="space-y-4">
            <div className="chat-loading-card"><RowSkeleton lines={4} /></div>
            <div className="chat-loading-card ml-auto max-w-2xl"><RowSkeleton lines={3} /></div>
            <div className="chat-loading-card"><RowSkeleton lines={5} /></div>
          </div>
        ) : null}

        {!isLoadingThread && !threadError && messages.length === 0 ? (
          <EmptyThreadState starterPrompts={starterPrompts} onUseStarterPrompt={onUseStarterPrompt} />
        ) : null}

        {threadState?.hasMore && messages.length > 0 ? (
          <div className="flex justify-center pb-4">
            <button type="button" onClick={onLoadMore} disabled={isFetchingThread} className="chat-load-older-button">
              {isFetchingThread ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock3 className="h-3.5 w-3.5" />}
              {isFetchingThread ? "Chargement..." : "Charger les messages précédents"}
            </button>
          </div>
        ) : null}

        {messages.map((message) => (
          <ThreadMessageCard
            key={message.id}
            message={message}
            detail={messageDetails[message.id]}
            loading={loadingMessageIds.has(message.id)}
            onOpen={onOpenMessageDetail}
          />
        ))}

        {sending ? <StreamingMessage /> : null}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
