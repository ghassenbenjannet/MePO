import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  CheckCheck,
  CircleDashed,
  ClipboardList,
  Eye,
  PlayCircle,
  Rows4,
} from "lucide-react";
import type { Ticket, TicketStatus, Topic } from "../../types/domain";

export type KanbanDensity = "compact" | "comfortable";
export type KanbanSort =
  | "priority_desc"
  | "updated_desc"
  | "updated_asc"
  | "title_asc";

export interface KanbanStatusDefinition {
  id: TicketStatus;
  label: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  icon: LucideIcon;
  dotClassName: string;
  textClassName: string;
  accentClassName: string;
  surfaceClassName: string;
  wipLimit?: number;
}

export interface KanbanCardViewModel {
  ticket: Ticket;
  topic: Topic | null;
  status: KanbanStatusDefinition;
  typeLabel: string;
  priorityLabel: string;
  priorityRank: number;
  primaryContext: string;
  secondaryContext: string | null;
  isBlocked: boolean;
  visibleTags: string[];
  hiddenTagCount: number;
  assigneeLabel: string;
  assigneeInitials: string;
  updatedLabel: string;
  updatedAtValue: number;
  dueLabel: string | null;
  metaSummary: string[];
}

export const KANBAN_COLS: KanbanStatusDefinition[] = [
  {
    id: "backlog",
    label: "Backlog",
    description: "À qualifier avant engagement",
    emptyTitle: "Aucune demande en qualification",
    emptyDescription: "Le backlog est vide pour ce périmètre ou les filtres actifs.",
    icon: Rows4,
    dotClassName: "bg-slate-500",
    textClassName: "text-slate-700",
    accentClassName: "text-slate-700",
    surfaceClassName: "border-slate-200 bg-slate-50/80",
    wipLimit: 24,
  },
  {
    id: "todo",
    label: "À faire",
    description: "Prêt à être pris en charge",
    emptyTitle: "Aucun ticket prêt",
    emptyDescription: "Rien n'attend de démarrage dans cette colonne.",
    icon: ClipboardList,
    dotClassName: "bg-brand-500",
    textClassName: "text-brand-700",
    accentClassName: "text-brand-700",
    surfaceClassName: "border-brand-200 bg-brand-50/90",
    wipLimit: 10,
  },
  {
    id: "in_progress",
    label: "En cours",
    description: "Travail activement traité",
    emptyTitle: "Aucun ticket actif",
    emptyDescription: "La capacité est disponible sur les travaux en cours.",
    icon: PlayCircle,
    dotClassName: "bg-amber-500",
    textClassName: "text-amber-700",
    accentClassName: "text-amber-700",
    surfaceClassName: "border-amber-200 bg-amber-50/90",
    wipLimit: 6,
  },
  {
    id: "review",
    label: "Revue",
    description: "En attente de validation ou décision",
    emptyTitle: "Aucune revue en attente",
    emptyDescription: "Aucun ticket n'attend de validation pour le moment.",
    icon: Eye,
    dotClassName: "bg-brand-400",
    textClassName: "text-brand-700",
    accentClassName: "text-brand-700",
    surfaceClassName: "border-brand-200 bg-brand-50/90",
    wipLimit: 5,
  },
  {
    id: "done",
    label: "Terminé",
    description: "Livré ou clôturé",
    emptyTitle: "Rien de terminé",
    emptyDescription: "Les éléments terminés apparaîtront ici.",
    icon: CheckCheck,
    dotClassName: "bg-brand-600",
    textClassName: "text-brand-800",
    accentClassName: "text-brand-800",
    surfaceClassName: "border-brand-300 bg-brand-100/90",
  },
  {
    id: "blocked",
    label: "Bloqué",
    description: "Blocage actif à lever",
    emptyTitle: "Aucun blocage actif",
    emptyDescription: "Les tickets bloqués sont centralisés ici pour pilotage.",
    icon: AlertTriangle,
    dotClassName: "bg-rose-500",
    textClassName: "text-rose-700",
    accentClassName: "text-rose-700",
    surfaceClassName: "border-rose-200 bg-rose-50/90",
    wipLimit: 3,
  },
];

const PRIORITY_LABELS: Record<string, string> = {
  low: "Faible",
  medium: "Moyenne",
  high: "Haute",
  critical: "Critique",
};

const PRIORITY_RANKS: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const TYPE_LABELS: Record<string, string> = {
  bug: "Bug",
  task: "Task",
  feature: "Feature",
  evolution: "Évolution",
  analysis: "Analyse",
  test: "Recette",
};

export function getStatusDefinition(status: TicketStatus) {
  return KANBAN_COLS.find((column) => column.id === status) ?? {
    id: status,
    label: status,
    description: "Statut personnalisé",
    emptyTitle: "Aucun ticket",
    emptyDescription: "Les tickets de ce statut apparaîtront ici.",
    icon: CircleDashed,
    dotClassName: "bg-slate-400",
    textClassName: "text-slate-700",
    accentClassName: "text-slate-700",
    surfaceClassName: "border-slate-200 bg-slate-50/80",
  };
}

export function getPriorityLabel(priority?: string | null) {
  return PRIORITY_LABELS[String(priority ?? "").toLowerCase()] ?? "Priorité non définie";
}

export function getPriorityRank(priority?: string | null) {
  return PRIORITY_RANKS[String(priority ?? "").toLowerCase()] ?? 0;
}

export function getTypeLabel(type?: string | null) {
  return TYPE_LABELS[String(type ?? "").toLowerCase()] ?? (type ? String(type) : "Type non défini");
}

export function getPriorityTone(priority?: string | null) {
  const normalized = String(priority ?? "").toLowerCase();
  if (normalized === "critical") return "border-rose-300 bg-rose-50 text-rose-700";
  if (normalized === "high") return "border-amber-300 bg-amber-50 text-amber-700";
  if (normalized === "medium") return "border-brand-300 bg-brand-50 text-brand-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function getTypeTone(type?: string | null) {
  const normalized = String(type ?? "").toLowerCase();
  if (normalized === "bug") return "border-rose-200 bg-white text-rose-700";
  if (normalized === "feature" || normalized === "evolution") return "border-brand-200 bg-white text-brand-700";
  if (normalized === "analysis") return "border-amber-200 bg-white text-amber-700";
  if (normalized === "test") return "border-brand-200 bg-white text-brand-700";
  return "border-slate-200 bg-white text-slate-700";
}

export function buildTopicMap(topics: Topic[]) {
  return new Map(topics.map((topic) => [topic.id, topic]));
}

function readDetailString(details: Record<string, unknown> | undefined, keys: string[]) {
  for (const key of keys) {
    const value = details?.[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function formatRelativeDate(dateValue: string | null) {
  if (!dateValue) return "Mise à jour inconnue";
  const timestamp = new Date(dateValue).getTime();
  if (Number.isNaN(timestamp)) return "Mise à jour inconnue";
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes < 1) return "À l'instant";
  if (diffMinutes < 60) return `Maj il y a ${diffMinutes} min`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `Maj il y a ${diffHours} h`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) return `Maj il y a ${diffDays} j`;
  return `Maj le ${new Date(timestamp).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}`;
}

function formatDueDate(dateValue: string | null) {
  if (!dateValue) return null;
  const timestamp = new Date(dateValue).getTime();
  if (Number.isNaN(timestamp)) return null;
  return `Échéance ${new Date(timestamp).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}`;
}

function extractPrimaryContext(ticket: Ticket, topic: Topic | null) {
  return (
    readDetailString(ticket.ticket_details, ["epic", "epic_name", "business_context", "context", "domain_context"])
    ?? topic?.title
    ?? "Sans contexte principal"
  );
}

function extractSecondaryContext(ticket: Ticket, topic: Topic | null) {
  return (
    readDetailString(ticket.ticket_details, ["business_need", "objective", "expected_behavior", "subject_to_analyze"])
    ?? (topic?.owner ? `Owner: ${topic.owner}` : null)
  );
}

function computeAssigneeLabel(ticket: Ticket) {
  return ticket.assignee?.trim() || "Non assigné";
}

function buildInitials(label: string) {
  const parts = label.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "NA";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function buildKanbanCardViewModel(ticket: Ticket, topic: Topic | null): KanbanCardViewModel {
  const status = getStatusDefinition(ticket.status);
  const assigneeLabel = computeAssigneeLabel(ticket);
  const dueLabel = formatDueDate(ticket.due_date);
  const updatedLabel = formatRelativeDate(ticket.updated_at ?? ticket.created_at);
  const updatedAtValue = new Date(ticket.updated_at ?? ticket.created_at ?? 0).getTime();
  const visibleTags = ticket.tags.slice(0, 2);
  const hiddenTagCount = Math.max(0, ticket.tags.length - visibleTags.length);
  const metaSummary = [
    ticket.estimate != null ? `${ticket.estimate} pt${ticket.estimate > 1 ? "s" : ""}` : null,
    ticket.linked_document_ids.length > 0 ? `${ticket.linked_document_ids.length} doc` : null,
    ticket.dependencies.length > 0 ? `${ticket.dependencies.length} dépendance${ticket.dependencies.length > 1 ? "s" : ""}` : null,
  ].filter(Boolean) as string[];
  const blockedReason = readDetailString(ticket.ticket_details, ["blocked_reason", "blocker", "blocking_issue"]);

  return {
    ticket,
    topic,
    status,
    typeLabel: getTypeLabel(ticket.type),
    priorityLabel: getPriorityLabel(ticket.priority),
    priorityRank: getPriorityRank(ticket.priority),
    primaryContext: extractPrimaryContext(ticket, topic),
    secondaryContext: blockedReason ?? extractSecondaryContext(ticket, topic),
    isBlocked: ticket.status === "blocked" || Boolean(blockedReason),
    visibleTags,
    hiddenTagCount,
    assigneeLabel,
    assigneeInitials: buildInitials(assigneeLabel),
    updatedLabel,
    updatedAtValue: Number.isNaN(updatedAtValue) ? 0 : updatedAtValue,
    dueLabel,
    metaSummary,
  };
}

export function compareTickets(sortBy: KanbanSort, left: KanbanCardViewModel, right: KanbanCardViewModel) {
  if (sortBy === "priority_desc") {
    const priorityDelta = right.priorityRank - left.priorityRank;
    if (priorityDelta !== 0) return priorityDelta;
    return right.updatedAtValue - left.updatedAtValue;
  }
  if (sortBy === "updated_asc") {
    return left.updatedAtValue - right.updatedAtValue;
  }
  if (sortBy === "title_asc") {
    return left.ticket.title.localeCompare(right.ticket.title, "fr", { sensitivity: "base" });
  }
  return right.updatedAtValue - left.updatedAtValue;
}
