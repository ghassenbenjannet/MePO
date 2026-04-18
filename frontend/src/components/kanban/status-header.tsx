import { cn } from "../../lib/utils";
import type { KanbanStatusDefinition } from "./kanban-types";

export function StatusHeader({
  column,
  ticketCount,
  blockedCount,
  urgentCount,
  wipExceededBy,
}: {
  column: KanbanStatusDefinition;
  ticketCount: number;
  blockedCount: number;
  urgentCount: number;
  wipExceededBy: number;
}) {
  const Icon = column.icon;
  const hasWipLimit = typeof column.wipLimit === "number";

  const pilotSummary = [
    urgentCount > 0 ? `${urgentCount} urgent${urgentCount > 1 ? "s" : ""}` : null,
    blockedCount > 0 ? `${blockedCount} bloque${blockedCount > 1 ? "s" : ""}` : null,
    wipExceededBy > 0 ? `WIP +${wipExceededBy}` : null,
  ].filter(Boolean);

  return (
    <header className="kanban-status-header">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className={cn("kanban-status-icon", column.textClassName)}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-[var(--text-strong)]">{column.label}</h3>
              <span className="kanban-status-count">{ticketCount}</span>
            </div>
            <p className="kanban-status-subcopy">{column.description}</p>
          </div>
        </div>

        {hasWipLimit ? (
          <span className={cn("kanban-status-wip", wipExceededBy > 0 && "kanban-status-wip-alert")}>
            {wipExceededBy > 0 ? `WIP +${wipExceededBy}` : `Limite ${column.wipLimit}`}
          </span>
        ) : null}
      </div>

      <p className="kanban-status-meta">
        {pilotSummary.length > 0 ? pilotSummary.join(" | ") : "Flux stable"}
      </p>
    </header>
  );
}
