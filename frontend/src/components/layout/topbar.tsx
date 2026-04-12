import { Search, Sparkles } from "lucide-react";

export function Topbar() {
  return (
    <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/60 px-6 py-4 backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Project context</p>
          <h2 className="text-lg font-semibold text-white">HCL - Livret / S1 2026</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-400">
            <Search className="h-4 w-4" />
            Search, jump, or run a command
            <span className="rounded-lg border border-white/10 px-2 py-0.5 text-xs text-slate-500">Ctrl K</span>
          </div>
          <button className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-slate-100">
            <Sparkles className="h-4 w-4" />
            Open AI
          </button>
        </div>
      </div>
    </header>
  );
}
