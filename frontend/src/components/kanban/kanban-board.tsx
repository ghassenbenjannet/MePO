import { KANBAN_COLS, type KanbanCardViewModel, type KanbanDensity } from "./kanban-types";
import { KanbanColumn } from "./kanban-column";

export function KanbanBoard({
  groupedTickets,
  density,
  dragTicketId,
  onOpenTicket,
  onMoveTicket,
  onDropTicket,
  onCreateTicket,
  onDragStart,
  onDragEnd,
}: {
  groupedTickets: Record<string, KanbanCardViewModel[]>;
  density: KanbanDensity;
  dragTicketId: string | null;
  onOpenTicket: (ticketId: string) => void;
  onMoveTicket: (ticket: KanbanCardViewModel, direction: "backward" | "forward") => void;
  onDropTicket: (ticketId: string, nextStatus: string) => void;
  onCreateTicket?: (statusId: string) => void;
  onDragStart: (ticketId: string) => void;
  onDragEnd: () => void;
}) {
  return (
    <div className="kanban-board" role="list" aria-label="Colonnes du Kanban">
      {KANBAN_COLS.map((column) => (
        <KanbanColumn
          key={column.id}
          column={column}
          tickets={groupedTickets[column.id] ?? []}
          density={density}
          dragTicketId={dragTicketId}
          canDrop={Boolean(dragTicketId)}
          onOpenTicket={onOpenTicket}
          onMoveTicket={onMoveTicket}
          onDropTicket={onDropTicket}
          onCreateTicket={onCreateTicket}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
      ))}
    </div>
  );
}
