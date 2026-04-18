import { ArrowLeft, ArrowRight, Edit3 } from "lucide-react";
import { cn } from "../../lib/utils";
import { PriorityBadge } from "./priority-badge";
import { getTypeTone, type KanbanCardViewModel } from "./kanban-types";

export function KanbanCard({
  card,
  compact,
  isDragging,
  canMoveBackward,
  canMoveForward,
  onOpen,
  onMoveBackward,
  onMoveForward,
  onDragStart,
  onDragEnd,
}: {
  card: KanbanCardViewModel;
  compact: boolean;
  isDragging: boolean;
  canMoveBackward: boolean;
  canMoveForward: boolean;
  onOpen: (ticketId: string) => void;
  onMoveBackward: () => void;
  onMoveForward: () => void;
  onDragStart: (ticketId: string) => void;
  onDragEnd: () => void;
}) {
  const visibleTag = card.visibleTags[0] ?? null;
  const showSupportingText = !compact;
  const showSupportingMeta = !compact && (card.dueLabel || card.metaSummary.length > 0);

  return (
    <article
      className={cn(
        "kanban-card group",
        compact ? "p-3.5" : "p-4",
        isDragging && "opacity-60 shadow-none",
      )}
      role="button"
      tabIndex={0}
      draggable
      aria-label={`Ouvrir le ticket ${card.ticket.id}`}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", card.ticket.id);
        onDragStart(card.ticket.id);
      }}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(card.ticket.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(card.ticket.id);
        }
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)]">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em]">{card.ticket.id}</span>
            {card.isBlocked ? <span className="kanban-card-flag">Bloque</span> : null}
          </div>
          <h4 className="kanban-card-title mt-2 text-sm font-semibold text-[var(--text-strong)]">
            {card.ticket.title || "Ticket sans titre"}
          </h4>
        </div>

        <div className="kanban-card-actions shrink-0" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            className="kanban-icon-button"
            onClick={() => onOpen(card.ticket.id)}
            aria-label={`Ouvrir ${card.ticket.id}`}
            title="Ouvrir le ticket"
          >
            <Edit3 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="kanban-icon-button"
            onClick={onMoveBackward}
            aria-label={`Deplacer ${card.ticket.id} vers la colonne precedente`}
            title="Deplacer vers la colonne precedente"
            disabled={!canMoveBackward}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="kanban-icon-button"
            onClick={onMoveForward}
            aria-label={`Deplacer ${card.ticket.id} vers la colonne suivante`}
            title="Deplacer vers la colonne suivante"
            disabled={!canMoveForward}
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className={cn("mt-3", compact ? "space-y-2.5" : "space-y-3")}>
        <div className="flex flex-wrap items-center gap-2">
          <PriorityBadge priority={card.ticket.priority} compact={compact} />
          <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium", getTypeTone(card.ticket.type))}>
            {card.typeLabel}
          </span>
          {visibleTag ? <span className="kanban-card-tag">#{visibleTag}</span> : null}
          {card.hiddenTagCount > 0 ? <span className="kanban-card-tag">+{card.hiddenTagCount}</span> : null}
        </div>

        <div className="space-y-1.5">
          <p className="kanban-card-context">{card.primaryContext}</p>
          {showSupportingText && card.secondaryContext ? (
            <p className="kanban-card-supporting">{card.secondaryContext}</p>
          ) : null}
        </div>

        <div className="kanban-card-meta">
          <span className="inline-flex min-w-0 items-center gap-2">
            <span className="kanban-card-avatar">{card.assigneeInitials}</span>
            <span className="truncate">{card.assigneeLabel}</span>
          </span>
          <span>{card.updatedLabel}</span>
        </div>

        {showSupportingMeta ? (
          <div className="kanban-card-supporting-meta">
            {card.dueLabel ? <span>{card.dueLabel}</span> : null}
            {card.metaSummary.slice(0, 1).map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
