import { Bell, Plus, Search, Sparkles } from "lucide-react";

export function Topbar() {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-white/85 px-5 py-4 backdrop-blur lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted">Project context</p>
          <h2 className="text-lg font-semibold text-ink">HCL - Livret / S1 2026</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-2xl border border-line bg-slate-50 px-4 py-2 text-sm text-muted xl:flex">
            <Search className="h-4 w-4" />
            Search, jump, or run a command
            <span className="rounded-lg border border-line bg-white px-2 py-0.5 text-xs text-muted">Ctrl K</span>
          </div>
          <button className="flex items-center gap-2 rounded-2xl border border-line bg-white px-4 py-2 text-sm font-medium text-ink transition hover:bg-slate-50">
            <Plus className="h-4 w-4" />
            Create
          </button>
          <button className="flex items-center gap-2 rounded-2xl bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600">
            <Sparkles className="h-4 w-4" />
            Open AI
          </button>
          <button className="flex h-10 w-10 items-center justify-center rounded-2xl border border-line bg-white text-muted transition hover:bg-slate-50">
            <Bell className="h-4 w-4" />
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white">
            MG
          </div>
        </div>
      </div>
    </header>
  );
}
