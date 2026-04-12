import { Sparkles, WandSparkles } from "lucide-react";
import { useUiStore } from "../../stores/ui-store";

export function RightDock() {
  const aiDockOpen = useUiStore((state) => state.aiDockOpen);

  if (!aiDockOpen) {
    return null;
  }

  return (
    <aside className="hidden w-[22rem] border-l border-line bg-slate-50/70 p-5 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 2xl:block">
      <div className="rounded-[28px] border border-line bg-white p-5 shadow-panel dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center gap-2 text-sm font-medium text-ink dark:text-white">
          <Sparkles className="h-4 w-4 text-brand-500" />
          AI context dock
        </div>
        <p className="mt-2 text-sm leading-6 text-muted dark:text-slate-400">
          Ask for a ticket draft, a functional analysis, a Gherkin scenario, or a memory update for the active topic.
        </p>
        <div className="mt-5 rounded-3xl border border-line bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-[0.2em] text-muted dark:text-slate-400">Active context</p>
          <ul className="mt-3 space-y-2 text-sm text-ink dark:text-slate-100">
            <li>Project: HCL - Livret</li>
            <li>Space: S1 2026</li>
            <li>Topic: Gestion multi-etablissements</li>
            <li>Related tickets: 12</li>
            <li>Documents linked: 4</li>
          </ul>
        </div>
        <div className="mt-5 rounded-3xl border border-line bg-brand-50 p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-[0.2em] text-brand-600">Shadow Core</p>
          <p className="mt-2 text-sm leading-6 text-muted dark:text-slate-400">Mode: Ticket. Context policy: topic first, memory second, related evidence only.</p>
        </div>
        <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white">
          <WandSparkles className="h-4 w-4" />
          Generate artifact with AI
        </button>
      </div>
    </aside>
  );
}
