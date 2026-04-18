import {
  ChevronRight,
  Plus,
  Search,
  Share2,
  SlidersHorizontal,
} from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useProjects } from "../../hooks/use-projects";
import { useSpaces } from "../../hooks/use-spaces";
import { projectPath, resolveEntityBySlug, spaceOverviewPath, spaceSuiviPath } from "../../lib/routes";
import { useAuthStore } from "../../stores/auth-store";
import { useUiStore } from "../../stores/ui-store";
import { cn } from "../../lib/utils";
import { initials, avatarGradient } from "../../lib/format";

interface TopbarProps {
  onOpenCommandPalette: () => void;
  onToggleDesignTweaks: () => void;
}

export function Topbar({ onOpenCommandPalette, onToggleDesignTweaks }: TopbarProps) {
  const navigate = useNavigate();
  const { projectSlug, spaceSlug } = useParams<{ projectSlug?: string; spaceSlug?: string }>();
  const user = useAuthStore((s) => s.user);
  const setCreateProjectModalOpen = useUiStore((s) => s.setCreateProjectModalOpen);

  const { pathname, search } = useLocation();
  const { data: projects = [] } = useProjects();
  const project = resolveEntityBySlug(projects, projectSlug);
  const projectId = project?.id;
  const { data: spaces = [] } = useSpaces(projectId);
  const space = resolveEntityBySlug(spaces, spaceSlug);
  const currentSuiviView = new URLSearchParams(search).get("view") ?? "overview";

  const currentSpacePage = space
    ? pathname.endsWith("/documents")
      ? "Documents"
      : pathname.endsWith("/chat")
        ? "Let's Chat"
        : pathname.endsWith("/suivi")
          ? (
            currentSuiviView === "kanban"
              ? "Kanban"
              : currentSuiviView === "tasks"
                ? "Taches"
                : currentSuiviView === "backlog"
                  ? "Backlog"
                  : currentSuiviView === "roadmap"
                    ? "Roadmap"
                    : currentSuiviView === "topics"
                      ? "Topics"
                      : "Cockpit"
          )
          : pathname.includes("/topics/")
            ? "Topic"
            : null
    : null;

  const userInitials = user?.full_name ? initials(user.full_name) : "?";
  const userGradient = avatarGradient(user?.full_name ?? "MePO");

  return (
    <header className="sticky top-0 z-20 flex h-[57px] flex-shrink-0 items-center gap-3 border-b border-[var(--rule)] bg-[var(--paper)] px-6 xl:px-8">
      <nav className="hidden min-w-0 items-center gap-2 text-[12.5px] text-[var(--ink-4)] xl:flex">
        <Link
          to="/"
          className="font-semibold text-[var(--ink)] transition hover:opacity-80"
        >
          MePO
        </Link>

        {project ? (
          <>
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-[var(--ink-5)]" />
            <Link
              to={projectPath(project)}
              className="max-w-[180px] truncate transition hover:text-[var(--ink)]"
            >
              {project.name}
            </Link>
          </>
        ) : null}

        {space ? (
          <>
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-[var(--ink-5)]" />
            <Link
              to={
                pathname.endsWith("/suivi")
                  ? spaceSuiviPath(
                    project ?? { id: projectId ?? "", name: projectSlug ?? "" },
                    space,
                    currentSuiviView === "topics" || currentSuiviView === "kanban" || currentSuiviView === "tasks" || currentSuiviView === "backlog" || currentSuiviView === "roadmap"
                      ? currentSuiviView
                      : "overview",
                  )
                  : spaceOverviewPath(
                    project ?? { id: projectId ?? "", name: projectSlug ?? "" },
                    space,
                  )
              }
              className={
                currentSpacePage
                  ? "max-w-[150px] truncate transition hover:text-[var(--ink)]"
                  : "max-w-[160px] truncate font-semibold text-[var(--accent-deep)] transition hover:opacity-80"
              }
            >
              {space.name}
            </Link>
          </>
        ) : null}

        {currentSpacePage ? (
          <>
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-[var(--ink-5)]" />
            <span className="max-w-[140px] truncate font-semibold text-[var(--ink)]">
              {currentSpacePage}
            </span>
          </>
        ) : null}
      </nav>

      <button
        onClick={onOpenCommandPalette}
        className={cn(
          "hidden min-w-0 max-w-[560px] flex-1 items-center gap-2 rounded-full border border-[var(--rule)] px-3 py-2 text-[13px] transition lg:flex",
          "bg-[var(--paper)] text-[var(--ink-4)]",
          "hover:border-[var(--ink-5)] hover:text-[var(--ink)]",
        )}
        type="button"
      >
        <Search className="h-3.5 w-3.5 flex-shrink-0 text-[var(--ink-5)]" />
        <span className="min-w-0 flex-1 truncate text-left">
          Rechercher projets, espaces, tickets...
        </span>
        <kbd className="hidden rounded border border-[var(--rule)] bg-[var(--paper-2)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--ink-5)] sm:block">
          Ctrl K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={onToggleDesignTweaks}
          title="Tweaks"
          className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-[var(--rule)] bg-transparent text-[var(--ink-4)] transition hover:bg-[var(--paper-2)] hover:text-[var(--ink)]"
          type="button"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          className="hidden h-8 items-center gap-1.5 rounded-[10px] border border-[var(--rule)] bg-transparent px-3 text-[12px] font-medium text-[var(--ink)] transition hover:bg-[var(--paper-2)] md:inline-flex"
        >
          <Share2 className="h-3.5 w-3.5" />
          Partager
        </button>

        <button
          onClick={() => {
            navigate("/");
            setCreateProjectModalOpen(true);
          }}
          className="btn-primary hidden h-8 items-center gap-1.5 rounded-[10px] px-3 text-[12.5px] sm:flex"
          type="button"
        >
          <Plus className="h-3.5 w-3.5" />
          Nouveau projet
        </button>

        <Link
          to="/profile"
          title={user?.full_name ?? "Profil"}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white transition hover:scale-[1.04]",
            `bg-gradient-to-br ${userGradient}`,
          )}
        >
          {userInitials}
        </Link>
      </div>
    </header>
  );
}
