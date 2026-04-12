import { Bell, Moon, Plus, Search, Sparkles, Sun } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useAuthStore } from "../../stores/auth-store";
import { useThemeStore } from "../../stores/theme-store";
import { useProject } from "../../hooks/use-projects";
import { useSpace } from "../../hooks/use-spaces";

export function Topbar() {
  const { projectId, spaceId } = useParams();
  const user = useAuthStore((s) => s.user);
  const mode = useThemeStore((s) => s.mode);
  const toggleMode = useThemeStore((s) => s.toggleMode);

  const { data: project } = useProject(projectId);
  const { data: space } = useSpace(spaceId);

  const initials = user?.full_name
    ? user.full_name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--bg-panel)] px-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm">
        {project ? (
          <>
            <Link to={`/projects/${project.id}`} className="font-medium text-[var(--text-strong)] hover:underline">
              {project.name}
            </Link>
            {space && (
              <>
                <span className="text-[var(--text-muted)]">/</span>
                <span className="text-[var(--text-muted)]">{space.name}</span>
              </>
            )}
          </>
        ) : (
          <span className="font-medium text-[var(--text-strong)]">Accueil</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="hidden items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 py-1.5 text-xs text-[var(--text-muted)] xl:flex">
          <Search className="h-3.5 w-3.5" />
          Rechercher…
          <kbd className="rounded border border-[var(--border)] px-1 py-0.5 text-[10px]">⌘K</kbd>
        </div>

        {/* Create */}
        <button className="flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-600">
          <Plus className="h-3.5 w-3.5" />
          Créer
        </button>

        {/* Let's Chat */}
        <button className="flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-panel-2)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition hover:text-[var(--text-strong)]">
          <Sparkles className="h-3.5 w-3.5 text-brand-500" />
          AI
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleMode}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] text-[var(--text-muted)] transition hover:bg-[var(--bg-panel-2)] hover:text-[var(--text-strong)]"
          aria-label="Toggle theme"
        >
          {mode === "light" ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
        </button>

        {/* Notifications */}
        <button className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] text-[var(--text-muted)] transition hover:bg-[var(--bg-panel-2)] hover:text-[var(--text-strong)]">
          <Bell className="h-3.5 w-3.5" />
        </button>

        {/* User avatar */}
        <Link
          to="/profile"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white"
          title={user?.full_name ?? "Profile"}
        >
          {initials}
        </Link>
      </div>
    </header>
  );
}
