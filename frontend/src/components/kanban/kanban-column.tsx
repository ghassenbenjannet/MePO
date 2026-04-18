import { useEffect, useMemo, useState } from "react";
import { Inbox, PlusCircle } from "lucide-react";

const PISTE_COLORS: Record<string, string> = {
  backlog: "var(--ink-4)",
  todo: "var(--cool)",
  in_progress: "var(--accent)",
  review: "var(--pink)",
  done: "var(--success)",
  blocked: "var(--hot)",
};
import { EmptyState } from "../ui/empty-state";
import { cn } from "../../lib/utils";
import { KanbanCard } from "./kanban-card";
import { StatusHeader } from "./status-header";
import type { KanbanCardViewModel, KanbanDensity, KanbanStatusDefinition } from "./kanban-types";

export function KanbanColumn({
  column,
  tickets,
  density,
  dragTicketId,
  canDrop,
  onOpenTicket,
  onMoveTicket,
  onDropTicket,
  onCreateTicket,
  onDragStart,
  onDragEnd,
}: {
  column: KanbanStatusDefinition;
  tickets: KanbanCardViewModel[];
  density: KanbanDensity;
  dragTicketId: string | null;
  canDrop: boolean;
  onOpenTicket: (ticketId: string) => void;
  onMoveTicket: (ticket: KanbanCardViewModel, direction: "backward" | "forward") => void;
  onDropTicket: (ticketId: string, nextStatus: string) => void;
  onCreateTicket?: (statusId: string) => void;
  onDragStart: (ticketId: string) => void;
  onDragEnd: () => void;
}) {
  const baseVisibleCount = density === "compact" ? 7 : 4;
  const step = density === "compact" ? 6 : 4;
  const [visibleCount, setVisibleCount] = useState(baseVisibleCount);
  const [isDropTarget, setIsDropTarget] = useState(false);

  useEffect(() => {
    setVisibleCount(baseVisibleCount);
  }, [baseVisibleCount, tickets.length]);

  const visibleTickets = useMemo(() => tickets.slice(0, visibleCount), [tickets, visibleCount]);
  const hiddenCount = Math.max(0, tickets.length - visibleCount);
  const urgentCount = tickets.filter((ticket) => ticket.priorityRank >= 3).length;
  const blockedCount = tickets.filter((ticket) => ticket.isBlocked).length;
  const wipExceededBy = column.wipLimit != null ? Math.max(0, tickets.length - column.wipLimit) : 0;

  const pisteColor = PISTE_COLORS[column.id] ?? "var(--border)";

  return (
    <section
      className="kanban-column"
      style={{ "--col": pisteColor } as React.CSSProperties}
      data-droppable={canDrop ? "true" : undefined}
      data-drag-over={isDropTarget ? "true" : undefined}
      aria-labelledby={`kanban-column-${column.id}`}
      onDragEnter={(event) => {
        event.preventDefault();
        if (dragTicketId) {
          setIsDropTarget(true);
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        if (dragTicketId && !isDropTarget) {
          setIsDropTarget(true);
        }
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setIsDropTarget(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDropTarget(false);
        const ticketId = event.dataTransfer.getData("text/plain");
        if (!ticketId) return;
        onDropTicket(ticketId, column.id);
      }}
    >
      <div id={`kanban-column-${column.id}`}>
        <StatusHeader
          column={column}
          ticketCount={tickets.length}
          blockedCount={blockedCount}
          urgentCount={urgentCount}
          wipExceededBy={wipExceededBy}
        />
      </div>

      <div
        className={cn(
          "kanban-column-body",
          canDrop && "ring-1 ring-brand-200/50",
          isDropTarget && "ring-2 ring-brand-400/40",
        )}
      >
        {visibleTickets.length === 0 ? (
          <EmptyState
            className="min-h-[200px] border-0 bg-transparent px-3 py-8 shadow-none"
            icon={<Inbox className="h-5 w-5" />}
            title={column.emptyTitle}
            description={column.emptyDescription}
            action={onCreateTicket ? (
              <button
                type="button"
                className="btn-secondary h-8 rounded-lg px-3 text-xs"
                onClick={() => onCreateTicket(column.id)}
              >
                <PlusCircle className="h-3.5 w-3.5" />
                Ajouter un ticket
              </button>
            ) : undefined}
          />
        ) : (
          <>
            {visibleTickets.map((card, index) => (
              <KanbanCard
                key={card.ticket.id}
                card={card}
                compact={density === "compact"}
                isDragging={dragTicketId === card.ticket.id}
                canMoveBackward={index >= 0 && column.id !== "backlog"}
                canMoveForward={column.id !== "blocked" && column.id !== "done"}
                onOpen={onOpenTicket}
                onMoveBackward={() => onMoveTicket(card, "backward")}
                onMoveForward={() => onMoveTicket(card, "forward")}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
              />
            ))}

            {hiddenCount > 0 ? (
              <button
                type="button"
                className="kanban-load-more"
                onClick={() => setVisibleCount((current) => current + step)}
              >
                Afficher {Math.min(step, hiddenCount)} ticket{hiddenCount > 1 ? "s" : ""} de plus
                <span className="text-[var(--text-muted)]">({hiddenCount} restant{hiddenCount > 1 ? "s" : ""})</span>
              </button>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
