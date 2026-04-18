import { ChevronLeft, Menu, Plus, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../ui/button";

type ChatHeaderProps = {
  backHref: string;
  spaceName?: string;
  projectName?: string;
  conversationTitle: string;
  topicsCount: number;
  ticketsCount: number;
  documentsCount: number;
  loadedMessages: number;
  totalMessages: number;
  creatingConversation: boolean;
  onCreateConversation: () => void;
  onToggleSidebar: () => void;
};

export function ChatHeader({
  backHref,
  spaceName,
  projectName,
  conversationTitle,
  topicsCount,
  ticketsCount,
  documentsCount,
  loadedMessages,
  totalMessages,
  creatingConversation,
  onCreateConversation,
  onToggleSidebar,
}: ChatHeaderProps) {
  const contextTotal = topicsCount + ticketsCount + documentsCount;

  return (
    <header className="chat-header-shell">
      <div className="chat-header-topline">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onToggleSidebar} className="chat-mobile-only chat-icon-button" aria-label="Ouvrir les conversations">
            <Menu className="h-4 w-4" />
          </button>
          <Link to={backHref} className="chat-nav-link">
            <ChevronLeft className="h-4 w-4" />
            Retour à l'espace
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={onCreateConversation}
            disabled={creatingConversation}
            leadingIcon={<Plus className="h-4 w-4" />}
            className="chat-header-action"
          >
            Nouvelle discussion
          </Button>
        </div>
      </div>

      <div className="chat-header-body">
        <div className="min-w-0">
          <p className="chat-header-breadcrumb">
            {projectName || "Projet"} / {spaceName || "Espace"} / Copilote IA
          </p>
          <h1 className="chat-header-title">{conversationTitle}</h1>
          <p className="chat-header-description">
            Une conversation structurée pour synthétiser le contexte, préparer une décision et transformer les signaux métier en actions concrètes.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="chat-toolbar-pill">
              <Sparkles className="h-3.5 w-3.5" />
              Copilote actif
            </span>
            <span className="chat-toolbar-pill-subtle">{loadedMessages} messages chargés</span>
            <span className="chat-toolbar-pill-subtle">{contextTotal} sources prêtes</span>
          </div>
        </div>

        <div className="chat-header-stats">
          <div className="chat-stat-card">
            <span className="chat-stat-label">Contexte chargé</span>
            <strong>{contextTotal}</strong>
            <span className="chat-stat-help">{topicsCount} topics • {ticketsCount} tickets • {documentsCount} docs</span>
          </div>
          <div className="chat-stat-card">
            <span className="chat-stat-label">Historique</span>
            <strong>{loadedMessages}/{totalMessages}</strong>
            <span className="chat-stat-help">messages visibles dans ce fil</span>
          </div>
        </div>
      </div>
    </header>
  );
}
