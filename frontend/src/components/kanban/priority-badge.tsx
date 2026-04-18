import { AlertTriangle, ArrowUp, ArrowUpDown, Minus } from "lucide-react";
import { cn } from "../../lib/utils";
import { getPriorityLabel, getPriorityTone } from "./kanban-types";

function PriorityIcon({ priority }: { priority?: string | null }) {
  const normalized = String(priority ?? "").toLowerCase();
  if (normalized === "critical") return <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />;
  if (normalized === "high") return <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />;
  if (normalized === "medium") return <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />;
  return <Minus className="h-3.5 w-3.5" aria-hidden="true" />;
}

export function PriorityBadge({ priority, compact = false }: { priority?: string | null; compact?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-semibold",
        compact ? "px-2 py-1 text-[10px]" : "px-2.5 py-1 text-[11px]",
        getPriorityTone(priority),
      )}
    >
      <PriorityIcon priority={priority} />
      <span>{getPriorityLabel(priority)}</span>
    </span>
  );
}
