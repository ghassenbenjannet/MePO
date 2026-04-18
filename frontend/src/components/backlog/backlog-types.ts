import type { ReactNode } from "react";
import type { Ticket, Topic } from "../../types/domain";
import {
  KANBAN_COLS,
  buildKanbanCardViewModel,
  getPriorityTone,
  getStatusDefinition,
  getTypeTone,
  type KanbanCardViewModel,
} from "../kanban/kanban-types";

export type BacklogDensity = "comfortable" | "compact";
export type BacklogSortKey = "title" | "priority" | "status" | "assignee" | "updated_at" | "topic";
export type BacklogSortDirection = "asc" | "desc";

export interface BacklogSortState {
  key: BacklogSortKey;
  direction: BacklogSortDirection;
}

export interface BacklogOption {
  value: string;
  label: string;
}

export interface BacklogFilterDefinition {
  key: string;
  label: string;
  value: string;
  options: BacklogOption[];
}

export interface BacklogColumnDefinition {
  key: string;
  label: string;
  sortable?: boolean;
  sortKey?: BacklogSortKey;
  headerClassName?: string;
  cellClassName?: string;
  priority?: "primary" | "secondary";
  hideBelow?: "lg" | "xl";
  render: (row: BacklogRowViewModel) => ReactNode;
}

export interface BacklogRowViewModel extends KanbanCardViewModel {
  searchText: string;
  typeTone: string;
  priorityTone: string;
  statusLabel: string;
  topicLabel: string;
  topicTone: string;
  topicDotTone: string;
  updatedFullLabel: string;
  updatedDateValue: number | null;
  assigneeSortValue: string | null;
  statusSortValue: number;
  contextLabel: string;
  metaHint: string | null;
  visibleTags: string[];
  hiddenTagCount: number;
}

const TOPIC_TONE_MAP: Record<string, { badge: string; dot: string }> = {
  indigo: { badge: "border-brand-200 bg-brand-50 text-brand-700", dot: "bg-brand-500" },
  blue: { badge: "border-brand-200 bg-brand-100 text-brand-800", dot: "bg-brand-400" },
  emerald: { badge: "border-brand-200 bg-brand-50 text-brand-700", dot: "bg-brand-500" },
  amber: { badge: "border-brand-200 bg-brand-100 text-brand-800", dot: "bg-brand-400" },
  rose: { badge: "border-rose-200 bg-rose-50 text-rose-700", dot: "bg-rose-500" },
  violet: { badge: "border-brand-200 bg-brand-50 text-brand-700", dot: "bg-brand-500" },
  cyan: { badge: "border-brand-200 bg-brand-100 text-brand-800", dot: "bg-brand-400" },
  orange: { badge: "border-brand-200 bg-brand-50 text-brand-700", dot: "bg-brand-500" },
  lime: { badge: "border-brand-200 bg-brand-100 text-brand-800", dot: "bg-brand-400" },
  slate: { badge: "border-slate-200 bg-slate-50 text-slate-700", dot: "bg-slate-500" },
};

function formatFullDate(dateValue: string | null) {
  if (!dateValue) return "Date inconnue";
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return "Date inconnue";
  return parsed.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusSortValue(statusId: string) {
  const index = KANBAN_COLS.findIndex((column) => column.id === statusId);
  return index >= 0 ? index : KANBAN_COLS.length + 1;
}

function buildSearchText(base: KanbanCardViewModel) {
  return [
    base.ticket.id,
    base.ticket.title,
    base.topic?.title ?? "",
    base.primaryContext,
    base.secondaryContext ?? "",
    base.assigneeLabel,
    ...base.ticket.tags,
  ]
    .join(" ")
    .toLocaleLowerCase("fr");
}

function getTopicTones(topic: Topic | null) {
  if (!topic) {
    return {
      topicTone: "border-slate-200 bg-slate-50 text-slate-600",
      topicDotTone: "bg-slate-400",
    };
  }
  const tone = TOPIC_TONE_MAP[topic.color] ?? TOPIC_TONE_MAP.indigo;
  return { topicTone: tone.badge, topicDotTone: tone.dot };
}

export function buildBacklogRowViewModel(ticket: Ticket, topic: Topic | null): BacklogRowViewModel {
  const base = buildKanbanCardViewModel(ticket, topic);
  const statusMeta = getStatusDefinition(ticket.status);
  const { topicTone, topicDotTone } = getTopicTones(topic);
  const updatedDateValue =
    ticket.updated_at || ticket.created_at
      ? new Date(ticket.updated_at ?? ticket.created_at ?? "").getTime()
      : null;
  const metaHint = base.metaSummary.length > 0 ? base.metaSummary.join(" · ") : null;

  return {
    ...base,
    searchText: buildSearchText(base),
    typeTone: getTypeTone(ticket.type),
    priorityTone: getPriorityTone(ticket.priority),
    statusLabel: statusMeta.label,
    topicLabel: topic?.title ?? "Sans topic",
    topicTone,
    topicDotTone,
    updatedFullLabel: formatFullDate(ticket.updated_at ?? ticket.created_at),
    updatedDateValue: updatedDateValue != null && !Number.isNaN(updatedDateValue) ? updatedDateValue : null,
    assigneeSortValue: ticket.assignee?.trim().toLocaleLowerCase("fr") || null,
    statusSortValue: getStatusSortValue(ticket.status),
    contextLabel: base.secondaryContext ?? base.primaryContext,
    metaHint,
    visibleTags: ticket.tags.slice(0, 2),
    hiddenTagCount: Math.max(0, ticket.tags.length - 2),
  };
}

function compareNullableString(left: string | null, right: string | null, direction: BacklogSortDirection) {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  const result = left.localeCompare(right, "fr", { sensitivity: "base" });
  return direction === "asc" ? result : -result;
}

function compareNullableNumber(left: number | null, right: number | null, direction: BacklogSortDirection) {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  const result = left - right;
  return direction === "asc" ? result : -result;
}

export function compareBacklogRows(left: BacklogRowViewModel, right: BacklogRowViewModel, sort: BacklogSortState) {
  if (sort.key === "priority") {
    const result = left.priorityRank - right.priorityRank;
    return sort.direction === "asc" ? result : -result;
  }
  if (sort.key === "status") {
    const result = left.statusSortValue - right.statusSortValue;
    return sort.direction === "asc" ? result : -result;
  }
  if (sort.key === "assignee") {
    return compareNullableString(left.assigneeSortValue, right.assigneeSortValue, sort.direction);
  }
  if (sort.key === "updated_at") {
    return compareNullableNumber(left.updatedDateValue, right.updatedDateValue, sort.direction);
  }
  if (sort.key === "topic") {
    return compareNullableString(left.topic?.title ?? null, right.topic?.title ?? null, sort.direction);
  }
  const result = left.ticket.title.localeCompare(right.ticket.title, "fr", { sensitivity: "base" });
  return sort.direction === "asc" ? result : -result;
}

export function buildStatusOptions(tickets: Ticket[]) {
  const seen = new Set<string>();
  const values = [
    ...KANBAN_COLS.map((column) => column.id),
    ...tickets.map((ticket) => ticket.status),
  ].filter((value) => {
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
  return values.map((value) => {
    const meta = getStatusDefinition(value);
    return { value, label: meta.label };
  });
}
