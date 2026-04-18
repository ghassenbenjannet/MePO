import { Sparkles, WandSparkles } from "lucide-react";
import { useUiStore } from "../../stores/ui-store";

export function RightDock() {
  const aiDockOpen = useUiStore((state) => state.aiDockOpen);

  if (!aiDockOpen) {
    return null;
  }

  return (
    <aside className="hidden w-[22rem] border-l border-line bg-[var(--bg-body)]/70 p-5 backdrop-blur 2xl:block">
      <div className="rounded-[28px] border border-line bg-[var(--bg-panel)] p-5 shadow-panel">
        <div className="flex items-center gap-2 text-sm font-medium text-ink dark:text-white">
          <Sparkles className="h-4 w-4 text-brand-500" />
          AI context dock
        </div>
        <p className="mt-2 text-sm leading-6 text-muted">
          Ask for a ticket draft, a functional analysis, a Gherkin scenario, or a memory update for the active topic.
        </p>
        <div className="mt-5 rounded-3xl border border-line bg-[var(--bg-panel-2)] p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Active context</p>
          <ul className="mt-3 space-y-2 text-sm text-ink">
            <li>Project: HCL - Livret</li>
            <li>Space: S1 2026</li>
            <li>Topic: Gestion multi-etablissements</li>
            <li>Related tickets: 12</li>
            <li>Documents linked: 4</li>
          </ul>
        </div>
        <div className="mt-5 rounded-3xl border border-line bg-[var(--bg-panel)] p-4 shadow-[var(--shadow-xs)]">
          <p className="text-xs uppercase tracking-[0.2em] text-brand-600">Shadow Core</p>
          <p className="mt-2 text-sm leading-6 text-muted">Mode: Ticket. Context policy: topic first, memory second, related evidence only.</p>
        </div>
        <button className="btn-primary mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold">
          <WandSparkles className="h-4 w-4" />
          Generate artifact with AI
        </button>
      </div>
    </aside>
  );
}
