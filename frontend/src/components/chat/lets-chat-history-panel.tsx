import { Clock, History, Loader2, MessageSquare, Trash2, X } from "lucide-react";
import type { ConversationSummary } from "../../hooks/use-conversations";
import { cn } from "../../lib/utils";

export function LetsChatHistoryPanel({
  conversations,
  activeConversationId,
  loadingConversationId,
  onClose,
  onLoadConversation,
  onDeleteConversation,
}: {
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  loadingConversationId: string | null;
  onClose: () => void;
  onLoadConversation: (conversation: ConversationSummary) => void;
  onDeleteConversation: (conversation: ConversationSummary) => void;
}) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-[rgba(252,251,247,0.98)] backdrop-blur-sm">
      <div className="flex flex-shrink-0 items-center justify-between border-b border-[var(--border-subtle)] px-6 py-4">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-[var(--brand)]" />
          <span className="text-sm font-semibold text-[var(--text-strong)]">Historique</span>
          {conversations.length > 0 ? (
            <span className="rounded-full bg-[var(--bg-panel)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
              {conversations.length}
            </span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-xmuted)] transition hover:border-[rgba(183,217,76,0.24)] hover:text-[var(--text-strong)]"
          aria-label="Fermer l'historique"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Clock className="h-8 w-8 text-[var(--text-xmuted)]" />
            <p className="text-sm font-medium text-[var(--text-muted)]">Aucune conversation sauvegardée</p>
            <p className="max-w-xs text-xs leading-6 text-[var(--text-xmuted)]">
              Les conversations sont conservées automatiquement après le premier échange.
            </p>
          </div>
        ) : (
          conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={cn(
                "group flex cursor-pointer items-start gap-3 rounded-[22px] border px-4 py-4 transition",
                loadingConversationId === conversation.id && "pointer-events-none opacity-60",
                activeConversationId === conversation.id
                  ? "border-[rgba(183,217,76,0.28)] bg-[var(--brand-light)]"
                  : "border-[var(--border)] bg-[var(--bg-panel-3)] hover:border-[rgba(183,217,76,0.24)] hover:bg-[var(--bg-panel)]",
              )}
              onClick={() => onLoadConversation(conversation)}
            >
              <MessageSquare
                className={cn(
                  "mt-0.5 h-4 w-4 flex-shrink-0",
                  activeConversationId === conversation.id ? "text-[var(--brand-dark)]" : "text-[var(--text-xmuted)]",
                )}
              />

              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "truncate text-sm font-semibold leading-tight",
                    activeConversationId === conversation.id ? "text-[var(--brand-dark)]" : "text-[var(--text-strong)]",
                  )}
                >
                  {conversation.title}
                </p>

                <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--text-xmuted)]">
                  <Clock className="h-2.5 w-2.5 flex-shrink-0" />
                  <span>
                    {new Date(conversation.updated_at ?? conversation.created_at).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  <span>•</span>
                  <span>{conversation.message_count} msg</span>
                  {loadingConversationId === conversation.id ? (
                    <>
                      <span>•</span>
                      <Loader2 className="h-3 w-3 animate-spin" />
                    </>
                  ) : null}
                </div>
              </div>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onDeleteConversation(conversation);
                }}
                className="flex-shrink-0 rounded-xl p-1.5 text-[var(--text-xmuted)] opacity-0 transition hover:bg-[var(--color-rose-50)] hover:text-[var(--danger)] group-hover:opacity-100"
                title="Supprimer la conversation"
                aria-label={`Supprimer ${conversation.title}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
