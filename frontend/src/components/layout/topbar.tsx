import { FolderOpen, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { NotificationCenter } from "../notifications/notification-center";
import { useProjectSuggestions } from "../../hooks/use-projects";
import { useAuthStore } from "../../stores/auth-store";
import { useUiStore } from "../../stores/ui-store";
import { cn } from "../../lib/utils";

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function Topbar() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setCreateProjectModalOpen = useUiStore((s) => s.setCreateProjectModalOpen);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const { data: suggestions = [], isFetching } = useProjectSuggestions(query);
  const visibleSuggestions = useMemo(() => suggestions.slice(0, 6), [suggestions]);

  const initials = user?.full_name ? getInitials(user.full_name) : "?";
  const showDropdown = focused && query.trim().length > 0;

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-slate-100 bg-white/95 px-5 backdrop-blur supports-[backdrop-filter]:bg-white/80">

      {/* Left: logo + search */}
      <div className="flex min-w-0 flex-1 items-center gap-5">
        <Link
          to="/"
          className="flex-shrink-0 text-[15px] font-bold tracking-[-0.02em] text-ink transition hover:opacity-80"
        >
          Me<span className="text-brand-500">PO</span>
        </Link>

        {/* Search */}
        <div className="relative hidden max-w-[440px] flex-1 xl:block">
          <div
            className={cn(
              "flex items-center gap-2 rounded-xl border bg-slate-50 px-3 py-2 transition-all",
              focused
                ? "border-brand-300 bg-white ring-4 ring-brand-100/60"
                : "border-slate-200 hover:border-slate-300",
            )}
          >
            <Search className="h-3.5 w-3.5 flex-shrink-0 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 150)}
              placeholder="Rechercher un projet…"
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
            />
            <kbd className="hidden rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-muted sm:block">
              ⌘K
            </kbd>
          </div>

          {showDropdown && (
            <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-float">
              {isFetching ? (
                <div className="px-4 py-3 text-sm text-muted">Recherche…</div>
              ) : visibleSuggestions.length > 0 ? (
                visibleSuggestions.map((project) => (
                  <button
                    key={project.id}
                    onMouseDown={() => {
                      setQuery("");
                      navigate(`/projects/${project.id}`);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-slate-50"
                  >
                    <FolderOpen className="h-4 w-4 flex-shrink-0 text-muted" />
                    <span className="flex-1 text-sm text-ink">{project.name}</span>
                    <span className="text-[11px] text-muted">Projet</span>
                  </button>
                ))
              ) : (
                <div className="px-4 py-3 text-sm text-muted">Aucun projet trouvé</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex flex-shrink-0 items-center gap-2">
        <button
          onClick={() => {
            navigate("/");
            setCreateProjectModalOpen(true);
          }}
          className="hidden items-center gap-2 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 sm:inline-flex"
        >
          <Plus className="h-4 w-4" />
          Nouveau projet
        </button>

        {/* Notification center */}
        <NotificationCenter />

        {/* User avatar */}
        <Link
          to="/profile"
          title={user?.full_name ?? "Profil"}
          className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white shadow-sm transition hover:scale-105 hover:shadow-md"
        >
          {initials}
        </Link>
      </div>
    </header>
  );
}
