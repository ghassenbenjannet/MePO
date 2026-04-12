import { Sparkles, WandSparkles } from "lucide-react";
import { useUiStore } from "../../stores/ui-store";

export function RightDock() {
  const aiDockOpen = useUiStore((state) => state.aiDockOpen);

  if (!aiDockOpen) {
    return null;
  }

  return (
    <aside className="hidden w-96 border-l border-white/10 bg-slate-950/70 p-5 backdrop-blur 2xl:block">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-soft">
        <div className="flex items-center gap-2 text-sm font-medium text-white">
          <Sparkles className="h-4 w-4 text-accent-500" />
          AI context dock
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Ask for a ticket draft, a functional analysis, a Gherkin scenario, or a memory update for the active topic.
        </p>
        <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Active context</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            <li>Project: HCL - Livret</li>
            <li>Space: S1 2026</li>
            <li>Topic: Gestion multi-etablissements</li>
            <li>Related tickets: 12</li>
            <li>Documents linked: 4</li>
          </ul>
        </div>
        <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-500 to-accent-500 px-4 py-3 text-sm font-semibold text-white">
          <WandSparkles className="h-4 w-4" />
          Generate artifact with AI
        </button>
      </div>
    </aside>
  );
}
