import type { SpaceSuiviView } from "../../lib/routes";
import { cn } from "../../lib/utils";

const SPACE_SUIVI_TABS = [
  { id: "overview" as SpaceSuiviView, label: "Overview" },
  { id: "topics" as SpaceSuiviView, label: "Topics" },
  { id: "kanban" as SpaceSuiviView, label: "Kanban" },
  { id: "tasks" as SpaceSuiviView, label: "Taches" },
  { id: "backlog" as SpaceSuiviView, label: "Backlog" },
  { id: "roadmap" as SpaceSuiviView, label: "Roadmap" },
];

export function SpaceSuiviTabs({
  activeTab,
  onChange,
  counts,
}: {
  activeTab: SpaceSuiviView;
  onChange: (tab: SpaceSuiviView) => void;
  counts?: Partial<Record<SpaceSuiviView, number>>;
}) {
  return (
    <div className="flex w-full flex-wrap items-center gap-1 border-b border-[var(--rule)]">
      {SPACE_SUIVI_TABS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            "inline-flex items-center gap-2 rounded-t-[10px] border-b-2 border-transparent px-3 py-2 text-[13px] transition",
            activeTab === id
              ? "border-[var(--accent)] text-[var(--ink)]"
              : "text-[var(--ink-4)] hover:text-[var(--ink)]",
          )}
        >
          <span>{label}</span>
          {counts?.[id] !== undefined ? (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]",
                activeTab === id
                  ? "bg-[var(--accent-soft)] text-[var(--accent-deep)]"
                  : "bg-[var(--paper-2)] text-[var(--ink-5)]",
              )}
            >
              {String(counts[id]).padStart(2, "0")}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
