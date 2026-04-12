import { Bell, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useProjectSuggestions } from "../../hooks/use-projects";
import { useAuthStore } from "../../stores/auth-store";
import { useUiStore } from "../../stores/ui-store";

export function Topbar() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const setCreateProjectModalOpen = useUiStore((state) => state.setCreateProjectModalOpen);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const { data: suggestions = [], isFetching } = useProjectSuggestions(query);

  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .filter(Boolean)
        .map((word) => word[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  const visibleSuggestions = useMemo(() => suggestions.slice(0, 6), [suggestions]);

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-[var(--border)] bg-[var(--bg-panel)] px-4">
      <div className="flex items-center gap-5">
        <Link to="/" className="text-lg font-bold tracking-tight text-[var(--text-strong)]">
          MePO
        </Link>

        <div className="relative hidden w-[34rem] xl:block">
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 py-2">
            <Search className="h-4 w-4 text-[var(--text-muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 120)}
              placeholder="Rechercher un projet..."
              className="w-full bg-transparent text-sm text-[var(--text-strong)] outline-none placeholder:text-[var(--text-muted)]"
            />
          </div>

          {focused && query.trim().length > 0 ? (
            <div className="absolute left-0 right-0 top-[calc(100%+8px)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] shadow-2xl">
              {isFetching ? (
                <div className="px-4 py-3 text-sm text-[var(--text-muted)]">Recherche...</div>
              ) : visibleSuggestions.length > 0 ? (
                visibleSuggestions.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => {
                      setQuery("");
                      navigate(`/projects/${project.id}`);
                    }}
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-[var(--text-strong)] transition hover:bg-[var(--bg-panel-2)]"
                  >
                    <span>{project.name}</span>
                    <span className="text-xs text-[var(--text-muted)]">Projet</span>
                  </button>
                ))
              ) : (
                <div className="px-4 py-3 text-sm text-[var(--text-muted)]">Aucun projet trouve</div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            navigate("/");
            setCreateProjectModalOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
        >
          <Plus className="h-4 w-4" />
          Creer un projet
        </button>
        <button className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-muted)] transition hover:bg-[var(--bg-panel-2)] hover:text-[var(--text-strong)]">
          <Bell className="h-4 w-4" />
        </button>
        <Link
          to="/profile"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white"
          title={user?.full_name ?? "Profil"}
        >
          {initials}
        </Link>
      </div>
    </header>
  );
}
