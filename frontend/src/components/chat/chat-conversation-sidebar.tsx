import { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Loader2, MessageSquareText, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { RowSkeleton } from "../ui/skeleton";
import { Button } from "../ui/button";
import type { ChatConversationPreview } from "../../hooks/use-chat-conversations";
import { cn } from "../../lib/utils";

type ChatSidebarProps = {
  conversations: ChatConversationPreview[];
  activeConversationId: string | null;
  loading: boolean;
  error: boolean;
  creatingConversation: boolean;
  deletingConversationId: string | null;
  renamingConversationId: string | null;
  onRetry: () => void;
  onCreateConversation: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, title: string) => Promise<boolean>;
  onCloseMobile?: () => void;
  className?: string;
};

type ConversationGroup = {
  id: string;
  label: string;
  items: ChatConversationPreview[];
};

function groupConversations(conversations: ChatConversationPreview[]): ConversationGroup[] {
  const buckets = new Map<string, ConversationGroup>();
  const now = new Date();

  conversations.forEach((conversation) => {
    const date = new Date(conversation.last_message_at);
    const ageInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    let bucket = "earlier";
    let label = "Plus anciens";
    if (ageInDays <= 0) {
      bucket = "today";
      label = "Aujourd'hui";
    } else if (ageInDays <= 7) {
      bucket = "week";
      label = "Cette semaine";
    }

    const current = buckets.get(bucket) ?? { id: bucket, label, items: [] };
    current.items.push(conversation);
    buckets.set(bucket, current);
  });

  return ["today", "week", "earlier"]
    .map((key) => buckets.get(key))
    .filter((group): group is ConversationGroup => Boolean(group))
    .map((group) => ({
      ...group,
      items: group.items.sort(
        (left, right) => new Date(right.last_message_at).getTime() - new Date(left.last_message_at).getTime(),
      ),
    }));
}

function formatConversationTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

const ConversationItem = memo(function ConversationItem({
  conversation,
  active,
  deleting,
  renaming,
  onSelect,
  onDelete,
  onRename,
}: {
  conversation: ChatConversationPreview;
  active: boolean;
  deleting: boolean;
  renaming: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => Promise<boolean>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(conversation.title);

  useEffect(() => {
    if (!isEditing) {
      setDraftTitle(conversation.title);
    }
  }, [conversation.title, isEditing]);

  const submitRename = useCallback(async () => {
    const nextTitle = draftTitle.trim();
    if (!nextTitle || nextTitle === conversation.title) {
      setDraftTitle(conversation.title);
      setIsEditing(false);
      return;
    }
    const renamed = await onRename(conversation.id, nextTitle);
    if (renamed) {
      setIsEditing(false);
    }
  }, [conversation.id, conversation.title, draftTitle, onRename]);

  const unreadLabel = conversation.unread_count > 0 ? `${conversation.unread_count} nouveau${conversation.unread_count > 1 ? "x" : ""}` : null;

  return (
    <div
      className={cn(
        "chat-conversation-item group",
        active && "chat-conversation-item-active",
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(conversation.id)}
        className="min-w-0 flex-1 text-left"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            {isEditing ? (
              <input
                autoFocus
                value={draftTitle}
                disabled={renaming}
                onChange={(event) => setDraftTitle(event.target.value)}
                onBlur={() => void submitRename()}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void submitRename();
                  }
                  if (event.key === "Escape") {
                    setDraftTitle(conversation.title);
                    setIsEditing(false);
                  }
                }}
                className="chat-conversation-input w-full"
              />
            ) : (
              <p className="truncate text-[13px] font-semibold leading-snug text-[var(--ink)]">
                {conversation.title}
              </p>
            )}
            {!isEditing && (
              <p className="mt-0.5 truncate text-[11.5px] leading-snug text-[var(--ink-4)]">
                {conversation.last_assistant_preview || "—"}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="chat-conversation-time">{formatConversationTime(conversation.last_message_at)}</span>
            {unreadLabel ? <span className="chat-unread-pill">{unreadLabel}</span> : null}
          </div>
        </div>
      </button>

      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          type="button"
          onClick={() => {
            setDraftTitle(conversation.title);
            setIsEditing(true);
          }}
          disabled={deleting || renaming}
          className="chat-icon-button"
          aria-label={`Renommer ${conversation.title}`}
        >
          {renaming ? <Loader2 className="h-3 w-3 animate-spin" /> : <Pencil className="h-3 w-3" />}
        </button>
        <button
          type="button"
          onClick={() => onDelete(conversation.id)}
          disabled={deleting || renaming}
          className="chat-icon-button"
          aria-label={`Supprimer ${conversation.title}`}
        >
          {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
        </button>
      </div>
    </div>
  );
});

export function ChatConversationSidebar({
  conversations,
  activeConversationId,
  loading,
  error,
  creatingConversation,
  deletingConversationId,
  renamingConversationId,
  onRetry,
  onCreateConversation,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
  onCloseMobile,
  className,
}: ChatSidebarProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const filteredConversations = useMemo(() => {
    if (!deferredQuery) return conversations;
    return conversations.filter((conversation) => {
      const title = conversation.title.toLowerCase();
      const preview = conversation.last_assistant_preview.toLowerCase();
      return title.includes(deferredQuery) || preview.includes(deferredQuery);
    });
  }, [conversations, deferredQuery]);

  const groupedConversations = useMemo(
    () => groupConversations(filteredConversations),
    [filteredConversations],
  );

  return (
    <aside className={cn("chat-sidebar-shell", className)}>
      <div className="chat-sidebar-panel">
        <div className="chat-sidebar-top">
          <div>
            <p className="chat-sidebar-eyebrow">Discussions</p>
            <h2 className="chat-sidebar-title">Let's chat</h2>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onCreateConversation}
              disabled={creatingConversation}
              leadingIcon={creatingConversation ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            >
              Nouveau
            </Button>
            {onCloseMobile ? (
              <button type="button" onClick={onCloseMobile} className="chat-mobile-only chat-icon-button" aria-label="Fermer le panneau">
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>

        <label className="chat-sidebar-search">
          <Search className="h-4 w-4 text-[var(--text-muted)]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un titre, un sujet, un extrait"
            className="chat-sidebar-search-input"
          />
        </label>

        <div className="chat-sidebar-summary">
          <span className="chat-toolbar-pill-subtle">{filteredConversations.length} résultat{filteredConversations.length > 1 ? "s" : ""}</span>
          <span className="chat-toolbar-pill-subtle">{conversations.length} conversation{conversations.length > 1 ? "s" : ""}</span>
        </div>

        <div className="chat-sidebar-list" role="list">
          {loading ? (
            <div className="space-y-3">
              <div className="chat-sidebar-skeleton"><RowSkeleton lines={3} /></div>
              <div className="chat-sidebar-skeleton"><RowSkeleton lines={3} /></div>
              <div className="chat-sidebar-skeleton"><RowSkeleton lines={2} /></div>
            </div>
          ) : error ? (
            <div className="chat-empty-card">
              <p className="font-semibold text-[var(--text-strong)]">Impossible de charger les conversations</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Retentez le chargement pour recuperer la liste.</p>
              <Button type="button" variant="secondary" size="sm" onClick={onRetry} className="mt-4">
                Reessayer
              </Button>
            </div>
          ) : groupedConversations.length === 0 && conversations.length === 0 ? (
            <div className="chat-empty-card">
              <MessageSquareText className="h-8 w-8 text-[var(--text-xmuted)]" />
              <p className="mt-3 font-semibold text-[var(--text-strong)]">Aucune conversation pour le moment</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Démarrez un premier fil pour ancrer la collaboration avec le copilote.
              </p>
            </div>
          ) : groupedConversations.length === 0 ? (
            <div className="chat-empty-card">
              <Search className="h-8 w-8 text-[var(--text-xmuted)]" />
              <p className="mt-3 font-semibold text-[var(--text-strong)]">Aucun résultat</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Essayez un autre titre, un mot-clé ou une période plus récente.
              </p>
            </div>
          ) : (
            groupedConversations.map((group) => (
              <section key={group.id} className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-xmuted)]">{group.label}</p>
                  <span className="text-[11px] text-[var(--text-xmuted)]">{group.items.length}</span>
                </div>
                <div className="space-y-2">
                  {group.items.map((conversation) => (
                    <ConversationItem
                      key={conversation.id}
                      conversation={conversation}
                      active={activeConversationId === conversation.id}
                      deleting={deletingConversationId === conversation.id}
                      renaming={renamingConversationId === conversation.id}
                      onSelect={(id) => {
                        onSelectConversation(id);
                        onCloseMobile?.();
                      }}
                      onDelete={onDeleteConversation}
                      onRename={onRenameConversation}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
