import { ChevronLeft, Clock3, FolderKanban, FolderOpen, Settings, Star } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useProjects } from "../../hooks/use-projects";
import { cn } from "../../lib/utils";
import { useUiStore } from "../../stores/ui-store";

export function Sidebar() {
  const { data: projects = [] } = useProjects();
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebarCollapsed = useUiStore((state) => state.toggleSidebarCollapsed);

  const recentProjects = projects.slice(0, 3);
  const favoriteProjects: typeof projects = [];

  const sections = [
    {
      key: "recent",
      title: "Recent",
      icon: Clock3,
      items: recentProjects,
      empty: "Aucun projet recent",
    },
    {
      key: "favorites",
      title: "Favoris",
      icon: Star,
      items: favoriteProjects,
      empty: "Aucun favori",
    },
    {
      key: "projects",
      title: "Mes projets",
      icon: FolderKanban,
      items: projects,
      empty: "Aucun projet",
    },
  ];

  return (
    <aside
      className={cn(
        "hidden flex-shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-panel)] transition-[width] duration-200 xl:flex",
        sidebarCollapsed ? "w-[88px]" : "w-72",
      )}
    >
      <div className="flex h-16 items-center justify-between border-b border-[var(--border)] px-4">
        <p className={cn("text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]", sidebarCollapsed && "hidden")}>
          Navigation
        </p>
        <button
          onClick={toggleSidebarCollapsed}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] text-[var(--text-muted)] transition hover:bg-[var(--bg-panel-2)] hover:text-[var(--text-strong)]"
          aria-label="Reduire ou ouvrir la navigation"
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform", sidebarCollapsed && "rotate-180")} />
        </button>
      </div>

      <nav className="flex flex-1 flex-col overflow-y-auto p-3">
        {sections.map((section) => (
          <div key={section.key} className="mb-5">
            <div className={cn("mb-2 flex items-center gap-2 px-2", sidebarCollapsed && "justify-center")}>
              <section.icon className="h-4 w-4 text-[var(--text-muted)]" />
              <p className={cn("text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]", sidebarCollapsed && "hidden")}>
                {section.title}
              </p>
            </div>

            {section.items.length > 0 ? (
              section.items.map((project) => (
                <NavLink
                  key={project.id}
                  to={`/projects/${project.id}`}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center rounded-xl px-3 py-2 text-sm transition",
                      sidebarCollapsed ? "justify-center" : "gap-2.5",
                      isActive
                        ? "bg-brand-500/10 font-semibold text-brand-500"
                        : "text-[var(--text-muted)] hover:bg-[var(--bg-panel-2)] hover:text-[var(--text-strong)]",
                    )
                  }
                  title={sidebarCollapsed ? project.name : undefined}
                >
                  <FolderOpen className="h-4 w-4 flex-shrink-0" />
                  <span className={cn("truncate", sidebarCollapsed && "hidden")}>{project.name}</span>
                </NavLink>
              ))
            ) : (
              <div className={cn("px-3 py-2 text-xs text-[var(--text-muted)]", sidebarCollapsed && "hidden")}>
                {section.empty}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="border-t border-[var(--border)] p-3">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              "flex items-center rounded-xl px-3 py-2 text-sm transition",
              sidebarCollapsed ? "justify-center" : "gap-2.5",
              isActive
                ? "bg-brand-500/10 font-semibold text-brand-500"
                : "text-[var(--text-muted)] hover:bg-[var(--bg-panel-2)] hover:text-[var(--text-strong)]",
            )
          }
          title={sidebarCollapsed ? "Parametre" : undefined}
        >
          <Settings className="h-4 w-4" />
          <span className={cn(sidebarCollapsed && "hidden")}>Parametre</span>
        </NavLink>
      </div>
    </aside>
  );
}
