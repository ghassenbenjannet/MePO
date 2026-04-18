import { startTransition, useDeferredValue, useMemo, useState } from "react";
import { AlertTriangle, FolderKanban, RefreshCcw, Search } from "lucide-react";
import { EmptyState } from "../ui/empty-state";
import { KanbanBoard } from "./kanban-board";
import { KanbanToolbar } from "./kanban-toolbar";
import { LoadingState } from "./loading-state";
import {
  KANBAN_COLS,
  buildKanbanCardViewModel,
  buildTopicMap,
  compareTickets,
  type KanbanCardViewModel,
  type KanbanDensity,
  type KanbanSort,
} from "./kanban-types";
import type { Ticket, Topic } from "../../types/domain";

function matchTicket(card: KanbanCardViewModel, query: string) {
  if (!query) return true;
  const haystack = [
    card.ticket.id,
    card.ticket.title,
    card.typeLabel,
    card.priorityLabel,
    card.primaryContext,
    card.secondaryContext,
    card.assigneeLabel,
    card.topic?.title ?? "",
    ...card.ticket.tags,
  ]
    .join(" ")
    .toLocaleLowerCase("fr");
  return haystack.includes(query);
}

export function KanbanPage({
  topics,
  tickets,
  loading = false,
  error = null,
  onRetry,
  onCreateTicket,
  onOpenTicket,
  onStatusChange,
}: {
  topics: Topic[];
  tickets: Ticket[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onCreateTicket?: (statusId?: string) => void;
  onOpenTicket: (ticket: Ticket) => void;
  onStatusChange: (ticket: Ticket, nextStatus: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [topicFilter, setTopicFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [blockedOnly, setBlockedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<KanbanSort>("priority_desc");
  const [density, setDensity] = useState<KanbanDensity>("comfortable");
  const [dragTicketId, setDragTicketId] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase("fr"));

  const topicMap = useMemo(() => buildTopicMap(topics), [topics]);
  const cards = useMemo(
    () => tickets.map((ticket) => buildKanbanCardViewModel(ticket, topicMap.get(ticket.topic_id) ?? null)),
    [tickets, topicMap],
  );

  const filteredCards = useMemo(() => {
    return cards
      .filter((card) => matchTicket(card, deferredQuery))
      .filter((card) => (topicFilter === "all" ? true : card.ticket.topic_id === topicFilter))
      .filter((card) => (assigneeFilter === "all" ? true : (card.ticket.assignee ?? "unassigned") === assigneeFilter))
      .filter((card) => (priorityFilter === "all" ? true : card.ticket.priority === priorityFilter))
      .filter((card) => (typeFilter === "all" ? true : card.ticket.type === typeFilter))
      .filter((card) => (blockedOnly ? card.isBlocked : true))
      .sort((left, right) => compareTickets(sortBy, left, right));
  }, [assigneeFilter, blockedOnly, cards, deferredQuery, priorityFilter, sortBy, topicFilter, typeFilter]);

  const groupedTickets = useMemo(() => {
    const groups = Object.fromEntries(KANBAN_COLS.map((column) => [column.id, [] as KanbanCardViewModel[]]));
    for (const card of filteredCards) {
      if (!groups[card.ticket.status]) {
        groups[card.ticket.status] = [];
      }
      groups[card.ticket.status].push(card);
    }
    return groups;
  }, [filteredCards]);

  const totalBlocked = filteredCards.filter((card) => card.isBlocked).length;
  const totalInProgress = filteredCards.filter((card) => card.ticket.status === "in_progress").length;
  const wipAlerts = KANBAN_COLS.reduce((count, column) => {
    if (column.wipLimit == null) return count;
    return count + ((groupedTickets[column.id]?.length ?? 0) > column.wipLimit ? 1 : 0);
  }, 0);
  const activeFilterCount = [
    query.trim(),
    topicFilter !== "all",
    assigneeFilter !== "all",
    priorityFilter !== "all",
    typeFilter !== "all",
    blockedOnly,
    sortBy !== "priority_desc",
    density !== "comfortable",
  ].filter(Boolean).length;

  const topicOptions = useMemo(
    () => [{ value: "all", label: "Tous les topics" }, ...topics.map((topic) => ({ value: topic.id, label: topic.title }))],
    [topics],
  );
  const assigneeOptions = useMemo(() => {
    const values = [...new Set(tickets.map((ticket) => ticket.assignee?.trim()).filter(Boolean) as string[])];
    return [
      { value: "all", label: "Tous les assignees" },
      { value: "unassigned", label: "Non assigne" },
      ...values.map((value) => ({ value, label: value })),
    ];
  }, [tickets]);
  const priorityOptions = [
    { value: "all", label: "Toutes les priorites" },
    { value: "critical", label: "Critique" },
    { value: "high", label: "Haute" },
    { value: "medium", label: "Moyenne" },
    { value: "low", label: "Faible" },
  ];
  const typeOptions = useMemo(() => {
    const values = [...new Set(tickets.map((ticket) => ticket.type).filter(Boolean))];
    return [{ value: "all", label: "Tous les types" }, ...values.map((value) => ({ value, label: value }))];
  }, [tickets]);

  function clearFilters() {
    startTransition(() => {
      setQuery("");
      setTopicFilter("all");
      setAssigneeFilter("all");
      setPriorityFilter("all");
      setTypeFilter("all");
      setBlockedOnly(false);
      setSortBy("priority_desc");
      setDensity("comfortable");
    });
  }

  function moveTicket(card: KanbanCardViewModel, direction: "backward" | "forward") {
    const currentIndex = KANBAN_COLS.findIndex((column) => column.id === card.ticket.status);
    if (currentIndex < 0) return;
    const nextIndex = direction === "forward" ? currentIndex + 1 : currentIndex - 1;
    const nextColumn = KANBAN_COLS[nextIndex];
    if (!nextColumn || nextColumn.id === card.ticket.status) return;
    onStatusChange(card.ticket, nextColumn.id);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <LoadingState />
      </div>
    );
  }

  if (error && tickets.length === 0) {
    return (
      <EmptyState
        icon={<AlertTriangle className="h-5 w-5" />}
        title="Impossible de charger le Kanban"
        description={error}
        action={onRetry ? (
          <button type="button" className="btn-secondary" onClick={onRetry}>
            <RefreshCcw className="h-4 w-4" />
            Reessayer
          </button>
        ) : undefined}
      />
    );
  }

  if (tickets.length === 0) {
    return (
      <EmptyState
        icon={<FolderKanban className="h-5 w-5" />}
        title="Aucun ticket dans ce Kanban"
        description="Creez un premier ticket pour alimenter les colonnes et lancer un pilotage plus lisible."
        action={onCreateTicket ? (
          <button type="button" className="btn-primary" onClick={() => onCreateTicket()}>
            Nouveau ticket
          </button>
        ) : undefined}
      />
    );
  }

  return (
    <div className="space-y-5">
      <section className="kanban-overview">
        <div className="min-w-0">
          <p className="kanban-overview-eyebrow">Pilotage</p>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="kanban-overview-copy">
                {wipAlerts > 0 ? `, ${wipAlerts} colonne${wipAlerts > 1 ? "s" : ""} a surveiller.` : "."}
              </p>
            </div>

            {onCreateTicket ? (
              <button type="button" className="btn-primary h-10 px-4 text-sm" onClick={() => onCreateTicket()}>
                Nouveau ticket
              </button>
            ) : null}
          </div>

          <div className="kanban-overview-summary" aria-live="polite">
            <span>{filteredCards.length} visibles</span>
            <span>{totalInProgress} en cours</span>
            <span>{totalBlocked} bloques</span>
            <span>{wipAlerts > 0 ? `${wipAlerts} risque${wipAlerts > 1 ? "s" : ""} WIP` : "Flux stable"}</span>
          </div>
        </div>

        {error ? (
          <div className="kanban-inline-warning">
            Les donnees affichees peuvent etre partielles: {error}
          </div>
        ) : null}
      </section>

      <KanbanToolbar
        query={query}
        onQueryChange={(value) => startTransition(() => setQuery(value))}
        topicFilter={topicFilter}
        onTopicFilterChange={(value) => startTransition(() => setTopicFilter(value))}
        assigneeFilter={assigneeFilter}
        onAssigneeFilterChange={(value) => startTransition(() => setAssigneeFilter(value))}
        priorityFilter={priorityFilter}
        onPriorityFilterChange={(value) => startTransition(() => setPriorityFilter(value))}
        typeFilter={typeFilter}
        onTypeFilterChange={(value) => startTransition(() => setTypeFilter(value))}
        blockedOnly={blockedOnly}
        onBlockedOnlyChange={(value) => startTransition(() => setBlockedOnly(value))}
        sortBy={sortBy}
        onSortByChange={(value) => startTransition(() => setSortBy(value))}
        density={density}
        onDensityChange={(value) => startTransition(() => setDensity(value))}
        totalVisible={filteredCards.length}
        totalTickets={tickets.length}
        activeFilterCount={activeFilterCount}
        topicOptions={topicOptions}
        assigneeOptions={assigneeOptions}
        priorityOptions={priorityOptions}
        typeOptions={typeOptions}
        onClearFilters={clearFilters}
      />

      {filteredCards.length === 0 ? (
        <EmptyState
          icon={<Search className="h-5 w-5" />}
          title="Aucun ticket ne correspond a ces criteres"
          description="Elargissez la recherche ou reouvrez les filtres avances pour revenir a une vue plus large."
          action={
            <button type="button" className="btn-secondary" onClick={clearFilters}>
              Reinitialiser les filtres
            </button>
          }
        />
      ) : (
        <KanbanBoard
          groupedTickets={groupedTickets}
          density={density}
          dragTicketId={dragTicketId}
          onOpenTicket={(ticketId) => {
            const ticket = tickets.find((item) => item.id === ticketId);
            if (ticket) onOpenTicket(ticket);
          }}
          onMoveTicket={moveTicket}
          onDropTicket={(ticketId, nextStatus) => {
            setDragTicketId(null);
            const ticket = tickets.find((item) => item.id === ticketId);
            if (!ticket || ticket.status === nextStatus) return;
            onStatusChange(ticket, nextStatus);
          }}
          onCreateTicket={onCreateTicket}
          onDragStart={setDragTicketId}
          onDragEnd={() => setDragTicketId(null)}
        />
      )}
    </div>
  );
}
