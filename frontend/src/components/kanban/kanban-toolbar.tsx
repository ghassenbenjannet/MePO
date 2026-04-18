import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "../../lib/utils";
import type { KanbanDensity, KanbanSort } from "./kanban-types";

type SelectOption = { value: string; label: string };

export function KanbanToolbar({
  query,
  onQueryChange,
  topicFilter,
  onTopicFilterChange,
  assigneeFilter,
  onAssigneeFilterChange,
  priorityFilter,
  onPriorityFilterChange,
  typeFilter,
  onTypeFilterChange,
  blockedOnly,
  onBlockedOnlyChange,
  sortBy,
  onSortByChange,
  density,
  onDensityChange,
  totalVisible,
  totalTickets,
  activeFilterCount,
  topicOptions,
  assigneeOptions,
  priorityOptions,
  typeOptions,
  onClearFilters,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  topicFilter: string;
  onTopicFilterChange: (value: string) => void;
  assigneeFilter: string;
  onAssigneeFilterChange: (value: string) => void;
  priorityFilter: string;
  onPriorityFilterChange: (value: string) => void;
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;
  blockedOnly: boolean;
  onBlockedOnlyChange: (value: boolean) => void;
  sortBy: KanbanSort;
  onSortByChange: (value: KanbanSort) => void;
  density: KanbanDensity;
  onDensityChange: (value: KanbanDensity) => void;
  totalVisible: number;
  totalTickets: number;
  activeFilterCount: number;
  topicOptions: SelectOption[];
  assigneeOptions: SelectOption[];
  priorityOptions: SelectOption[];
  typeOptions: SelectOption[];
  onClearFilters: () => void;
}) {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const hasAdvancedFilters = priorityFilter !== "all" || typeFilter !== "all" || sortBy !== "priority_desc";
  const visibleFilterCount = [query.trim(), topicFilter !== "all", assigneeFilter !== "all", blockedOnly].filter(Boolean).length;
  const advancedFilterCount = [
    priorityFilter !== "all",
    typeFilter !== "all",
    sortBy !== "priority_desc",
  ].filter(Boolean).length;

  useEffect(() => {
    if (hasAdvancedFilters) {
      setShowAdvancedFilters(true);
    }
  }, [hasAdvancedFilters]);

  return (
    <section className="kanban-toolbar">
      <div className="kanban-toolbar-main-row">
        <label className="kanban-search">
          <Search className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Rechercher un ticket, un contexte ou un assignee"
            className="w-full bg-transparent text-sm text-[var(--text-strong)] outline-none placeholder:text-[var(--text-xmuted)]"
            aria-label="Rechercher dans les tickets"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="kanban-toolbar-button"
            onClick={() => setShowAdvancedFilters((current) => !current)}
            aria-expanded={showAdvancedFilters}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Plus de filtres
            {advancedFilterCount > 0 ? <span className="kanban-toolbar-counter">{advancedFilterCount}</span> : null}
            {showAdvancedFilters ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          <div className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-white/72 p-1">
            <button
              type="button"
              className={cn("kanban-density-button", density === "compact" && "kanban-density-button-active")}
              onClick={() => onDensityChange("compact")}
              aria-pressed={density === "compact"}
            >
              Compacte
            </button>
            <button
              type="button"
              className={cn("kanban-density-button", density === "comfortable" && "kanban-density-button-active")}
              onClick={() => onDensityChange("comfortable")}
              aria-pressed={density === "comfortable"}
            >
              Confort
            </button>
          </div>
        </div>
      </div>

      <div className="kanban-toolbar-major">
        <ToolbarSelect label="Topic" value={topicFilter} onChange={onTopicFilterChange} options={topicOptions} />
        <ToolbarSelect label="Assignee" value={assigneeFilter} onChange={onAssigneeFilterChange} options={assigneeOptions} />
        <button
          type="button"
          className={cn("kanban-toolbar-button", blockedOnly && "kanban-toolbar-button-active")}
          onClick={() => onBlockedOnlyChange(!blockedOnly)}
          aria-pressed={blockedOnly}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Bloques seulement
        </button>

        <div className="kanban-toolbar-inline-summary" aria-live="polite">
          <span>{totalVisible}/{totalTickets} visibles</span>
          <span>
            {activeFilterCount > 0
              ? `${activeFilterCount} filtre${activeFilterCount > 1 ? "s" : ""}`
              : "Vue complete"}
          </span>
          {visibleFilterCount > 0 || advancedFilterCount > 0 ? (
            <button type="button" className="kanban-toolbar-clear" onClick={onClearFilters}>
              <X className="h-3.5 w-3.5" />
              Effacer
            </button>
          ) : null}
        </div>
      </div>

      {showAdvancedFilters ? (
        <div className="kanban-toolbar-advanced">
          <ToolbarSelect label="Priorite" value={priorityFilter} onChange={onPriorityFilterChange} options={priorityOptions} />
          <ToolbarSelect label="Type" value={typeFilter} onChange={onTypeFilterChange} options={typeOptions} />
          <ToolbarSelect
            label="Tri"
            value={sortBy}
            onChange={(value) => onSortByChange(value as KanbanSort)}
            options={[
              { value: "priority_desc", label: "Priorite decroissante" },
              { value: "updated_desc", label: "Derniere mise a jour" },
              { value: "updated_asc", label: "Plus ancien d abord" },
              { value: "title_asc", label: "Titre A a Z" },
            ]}
          />
        </div>
      ) : null}
    </section>
  );
}

function ToolbarSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
}) {
  return (
    <label className="kanban-select">
      <span className="kanban-select-label">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="kanban-select-input"
        aria-label={label}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
