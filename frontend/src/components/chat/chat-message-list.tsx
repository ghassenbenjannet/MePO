import { memo, useCallback, useMemo, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { Check, ChevronDown, Clock3, Copy, Loader2, RefreshCcw, Sparkles } from "lucide-react";
import type {
  ChatMessageDetail,
  ChatMessagePreview,
  ChatProposedActionCard,
  ChatSourceUsed,
} from "../../hooks/use-chat-conversations";
import { Button } from "../ui/button";
import { RowSkeleton } from "../ui/skeleton";
import { cn } from "../../lib/utils";
import { ChatMarkdown } from "./chat-markdown";
import type { ChatStarterPrompt, ChatThreadState } from "./chat-ui-types";

type ChatMessageListProps = {
  messages: ChatMessagePreview[];
  messageDetails: Record<string, ChatMessageDetail>;
  loadingMessageIds: Set<string>;
  threadState: ChatThreadState | null;
  isLoadingThread: boolean;
  isFetchingThread: boolean;
  threadError: boolean;
  sending: boolean;
  onRetryThread: () => void;
  onOpenMessageDetail: (id: string) => void;
  onLoadMore: () => void;
  onActionClick?: (action: ChatProposedActionCard) => void;
  starterPrompts: ChatStarterPrompt[];
  onUseStarterPrompt: (prompt: string) => void;
  scrollRef: RefObject<HTMLDivElement>;
  bottomRef: RefObject<HTMLDivElement>;
};

function buildBody(message: ChatMessagePreview, detail?: ChatMessageDetail) {
  if (!detail) return message.preview_text;
  return message.role === "assistant" ? (detail.rendered_answer ?? detail.full_text) : detail.full_text;
}

function buildCopyValue(message: ChatMessagePreview, detail?: ChatMessageDetail) {
  return detail?.full_text || detail?.rendered_answer || message.preview_text;
}

function buildAssistantSummary(detail?: ChatMessageDetail) {
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

const ACTION_TYPE_LABELS: Record<string, string> = {
  create_ticket: "Créer un ticket",
  create_topic: "Créer un topic",
  create_document: "Créer un document",
  add_comment: "Ajouter un commentaire",
};

const ActionBadge = memo(function ActionBadge({
  action,
  onClick,
}: {
  action: ChatProposedActionCard;
  onClick?: (action: ChatProposedActionCard) => void;
}) {
  const typeLabel = ACTION_TYPE_LABELS[action.type] ?? action.type;
  return (
    <button
      type="button"
      className="chat-action-card w-full text-left transition hover:border-[var(--accent)] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      onClick={() => onClick?.(action)}
    >
      <p className="text-[13px] font-semibold leading-snug text-[var(--text-strong)]">{action.label}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--accent-deep)]">
          {typeLabel}
        </span>
        {action.target_label && (
          <span className="text-[11px] text-[var(--text-muted)]">{action.target_label}</span>
        )}
        {action.requires_confirmation && (
          <span className="inline-flex items-center rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] text-[var(--text-muted)]">
            confirmation requise
          </span>
        )}
      </div>
    </button>
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

const ROLE_LABELS: Record<string, string> = {
  regle_metier: "règle métier",
  preuve_technique: "preuve tech.",
  validation: "validation",
  contradiction: "contradiction",
  reference: "référence",
};

const ROLE_COLORS: Record<string, string> = {
  regle_metier: "bg-blue-400",
  preuve_technique: "bg-violet-400",
  validation: "bg-emerald-400",
  contradiction: "bg-red-400",
  reference: "bg-[var(--text-muted)]",
};

const EVIDENCE_LABELS: Record<string, { label: string; color: string }> = {
  strong:   { label: "Preuves solides",     color: "text-emerald-600" },
  moderate: { label: "Preuves partielles",  color: "text-amber-600" },
  weak:     { label: "Preuves faibles",     color: "text-orange-500" },
  none:     { label: "Sans preuve doc.",    color: "text-red-500" },
};


function SourceUsedChip({ source }: { source: ChatSourceUsed }) {
  const dotColor = ROLE_COLORS[source.role] ?? ROLE_COLORS.reference;
  const roleLabel = ROLE_LABELS[source.role] ?? source.role;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-panel-2)] px-2.5 py-1 text-[11px]">
      <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", dotColor)} />
      <span className="truncate max-w-[180px] font-medium text-[var(--text-strong)]">{source.title}</span>
      <span className="text-[10px] text-[var(--text-muted)]">· {roleLabel}</span>
    </span>
  );
}

function EvidenceBadge({ level }: { level: string }) {
  const info = EVIDENCE_LABELS[level];
  if (!info) return null;
  return (
    <span className={cn("text-[11px] font-medium", info.color)}>
      {info.label}
    </span>
  );
}

const ThreadMessageCard = memo(function ThreadMessageCard({
  message,
  detail,
  loading,
  onOpen,
  onActionClick,
}: {
  message: ChatMessagePreview;
  detail?: ChatMessageDetail;
  loading: boolean;
  onOpen: (id: string) => void;
  onActionClick?: (action: ChatProposedActionCard) => void;
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

  const timeLabel = new Date(message.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  return (
    <article
      className={cn(
        "chat-message-row",
        isAssistant ? "chat-message-row-assistant" : "chat-message-row-user",
      )}
      style={{ contentVisibility: "auto", containIntrinsicSize: isAssistant ? "520px" : "180px" }}
    >
      {/* Avatar */}
      <span className={cn("chat-avatar mt-0.5", isAssistant ? "chat-avatar-assistant" : "chat-avatar-user")}>
        {isAssistant ? "AI" : "V"}
      </span>

      {/* Content */}
      <div className="chat-bubble min-w-0 flex-1">
        {/* Row header */}
        <div className="chat-message-head">
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] font-semibold text-[var(--ink)]">
              {isAssistant ? "MePO" : "Vous"}
            </span>
            {isAssistant && (
              <span className="text-[10.5px] font-mono text-[var(--ink-4)] tracking-wider uppercase">
                · assistant
              </span>
            )}
            <span className="text-[10.5px] font-mono text-[var(--ink-5)]">{timeLabel}</span>
          </div>
          <div className="flex items-center gap-1">
            <MessageUtilityButton
              label={copied ? "Copié" : "Copier"}
              icon={copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              onClick={() => void handleCopy()}
            />
            {(message.is_truncated || (message.has_detail && !detail)) ? (
              <MessageUtilityButton
                label={loading ? "..." : "Déplier"}
                icon={loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronDown className="h-3 w-3" />}
                onClick={() => onOpen(message.id)}
                disabled={loading}
              />
            ) : null}
          </div>
        </div>

        {/* Body */}
        {isAssistant ? (
          <div className="chat-ai-card">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-mono tracking-widest uppercase text-[rgba(252,252,251,0.5)]">
                MePO · synthèse
              </span>
              {assistantSummary && (
                <span className="text-[10.5px] text-[rgba(252,252,251,0.45)]">· {assistantSummary}</span>
              )}
            </div>
            <ChatMarkdown content={body} />

            {detail?.warning_no_docs ? (
              <div className="mt-3 flex items-start gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-2">
                <span className="text-amber-300 text-[11px]">⚠</span>
                <p className="text-[11px] text-amber-200">{detail.warning_no_docs}</p>
              </div>
            ) : null}

            {detail && (detail.retrieved_docs_count > 0 || detail.corpus_status) ? (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="chat-section-chip">Corpus</span>
                <span className="text-[11px] text-[rgba(252,252,251,0.5)]">
                  {detail.retrieved_docs_count > 0
                    ? `${detail.retrieved_docs_count} doc${detail.retrieved_docs_count > 1 ? "s" : ""} chargé${detail.retrieved_docs_count > 1 ? "s" : ""}`
                    : "Aucun doc chargé"}
                </span>
                {detail.retained_docs_count > 0 && (
                  <span className="text-[11px] text-emerald-400">
                    · {detail.retained_docs_count} cité{detail.retained_docs_count > 1 ? "s" : ""}
                  </span>
                )}
                <EvidenceBadge level={detail.evidence_level ?? "none"} />
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-1">
            <div className="chat-user-message-body">{body}</div>
          </div>
        )}

        {/* Sources */}
        {detail?.sources_used?.length ? (
          <div className="mt-2.5 space-y-1.5">
            <span className="chat-section-chip">Sources</span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {detail.sources_used.map((src) => (
                <SourceUsedChip key={src.doc_id} source={src} />
              ))}
            </div>
          </div>
        ) : null}

        {/* Related objects */}
        {detail?.related_objects.length ? (
          <div className="mt-3 space-y-2">
            <span className="chat-section-chip">Références</span>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 mt-1">
              {detail.related_objects.map((item) => (
                <RelatedObjectCard key={`${item.kind}-${item.id}`} item={item} />
              ))}
            </div>
          </div>
        ) : null}

        {/* Actions */}
        {detail?.actions.length ? (
          <div className="mt-3 space-y-2">
            <span className="chat-section-chip">Actions proposées</span>
            <div className="grid gap-2 sm:grid-cols-2 mt-1">
              {detail.actions.map((action) => (
                <ActionBadge key={action.id} action={action} onClick={onActionClick} />
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
  onActionClick,
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
            onActionClick={onActionClick}
          />
        ))}

        {sending ? <StreamingMessage /> : null}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
