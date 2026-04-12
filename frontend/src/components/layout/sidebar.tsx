import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  FolderOpen,
  LayoutDashboard,
  Settings,
  Sparkles,
  Star,
} from "lucide-react";
import { NavLink, useParams } from "react-router-dom";
import { useProject, useProjects } from "../../hooks/use-projects";
import { useSpaces } from "../../hooks/use-spaces";
import { cn } from "../../lib/utils";
import { useUiStore } from "../../stores/ui-store";

// ─── Status dot ───────────────────────────────────────────────────────────────

function SpaceDot({ isFav, isActive }: { isFav: boolean; isActive: boolean }) {
  return (
    <span
      className={cn(
        "h-1.5 w-1.5 flex-shrink-0 rounded-full transition",
        isActive ? "bg-brand-500" : isFav ? "bg-emerald-500" : "bg-slate-300",
      )}
    />
  );
}

// ─── Nav item ─────────────────────────────────────────────────────────────────

function NavItem({
  to,
  icon: Icon,
  label,
  collapsed,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  collapsed: boolean;
}) {
  return (
    <NavLink
      to={to}
      end
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          "group relative flex items-center rounded-xl px-2.5 py-2 text-sm font-medium transition-colors",
          collapsed ? "justify-center" : "gap-2.5",
          isActive
            ? "bg-brand-50 text-brand-700 shadow-sm"
            : "text-muted hover:bg-zinc-100 hover:text-ink",
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && !collapsed && (
            <span className="absolute left-0 inset-y-1 w-0.5 rounded-full bg-brand-500" />
          )}
          <Icon className={cn("h-4 w-4 flex-shrink-0 transition-colors", collapsed ? "" : "ml-1.5")} />
          {!collapsed && <span className="truncate">{label}</span>}
        </>
      )}
    </NavLink>
  );
}

// ─── Main sidebar ─────────────────────────────────────────────────────────────

export function Sidebar() {
  const { projectId, spaceId } = useParams<{ projectId?: string; spaceId?: string }>();
  const { data: projects = [] } = useProjects();
  const { data: activeProject } = useProject(projectId);
  const { data: projectSpaces = [] } = useSpaces(projectId);
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebarCollapsed);

  const favoriteProjects = projects.filter(
    (p) => p.status === "active",
  ).slice(0, 3);

  return (
    <aside
      className={cn(
        "hidden flex-shrink-0 flex-col border-r border-slate-100 bg-white transition-[width] duration-200 xl:flex",
        collapsed ? "w-[56px]" : "w-64",
      )}
    >
      {/* Header */}
      <div className="flex h-14 items-center border-b border-slate-100 px-3">
        {!collapsed && (
          <span className="flex-1 truncate px-1 text-[11px] font-semibold uppercase tracking-widest text-muted">
            Navigation
          </span>
        )}
        <button
          onClick={toggle}
          title={collapsed ? "Ouvrir la navigation" : "Réduire"}
          className={cn(
            "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 text-muted transition hover:bg-slate-50 hover:text-ink",
            collapsed && "mx-auto",
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {/* Fixed links */}
        <NavItem to="/" icon={LayoutDashboard} label="Tableau de bord" collapsed={collapsed} />

        {/* Separator */}
        <div className={cn("my-2 border-t border-slate-100", collapsed && "mx-1")} />

        {/* Recents */}
        {!collapsed && (
          <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted/70">
            Récents
          </p>
        )}
        {collapsed && (
          <div className="mb-1 flex justify-center">
            <Clock3 className="h-3.5 w-3.5 text-muted/60" />
          </div>
        )}
        {projects.slice(0, 3).map((project) => {
          const isCurrentProject = project.id === projectId;
          return (
            <div key={`recent-${project.id}`}>
              <NavLink
                to={`/projects/${project.id}`}
                title={collapsed ? project.name : undefined}
                className={({ isActive }) =>
                  cn(
                    "relative flex items-center rounded-xl px-2.5 py-2 text-sm transition-colors",
                    collapsed ? "justify-center" : "gap-2.5",
                    isActive || isCurrentProject
                      ? "bg-brand-50 font-medium text-brand-700"
                      : "text-muted hover:bg-zinc-100 hover:text-ink",
                  )
                }
              >
                <FolderOpen className="h-4 w-4 flex-shrink-0" />
                {!collapsed && <span className="truncate">{project.name}</span>}
              </NavLink>

              {/* Spaces tree */}
              {!collapsed && isCurrentProject && (
                <div className="mt-1 mb-1 ml-3 space-y-0.5 rounded-xl border border-slate-100 bg-slate-50/70 p-1.5">
                  <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted/60">
                    {activeProject?.name ?? "Projet"} · Espaces
                  </p>
                  {projectSpaces.length > 0 ? (
                    projectSpaces.map((space) => {
                      const isActiveSpace = space.id === spaceId;
                      return (
                        <NavLink
                          key={space.id}
                          to={`/projects/${project.id}/spaces/${space.id}`}
                          className={cn(
                            "relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                            isActiveSpace
                              ? "bg-white font-semibold text-brand-700 shadow-sm ring-1 ring-brand-100"
                              : "text-muted hover:bg-white/80 hover:text-ink",
                          )}
                        >
                          <SpaceDot isFav={space.is_favorite} isActive={isActiveSpace} />
                          <span className="truncate">{space.name}</span>
                        </NavLink>
                      );
                    })
                  ) : (
                    <p className="px-2 py-1.5 text-xs text-muted/60">Aucun espace</p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Separator */}
        {!collapsed && favoriteProjects.length > 0 && (
          <>
            <div className="my-2 border-t border-slate-100" />
            <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted/70">
              Favoris
            </p>
            {favoriteProjects.map((p) => (
              <NavLink
                key={`fav-${p.id}`}
                to={`/projects/${p.id}`}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-amber-50 font-medium text-amber-700"
                      : "text-muted hover:bg-slate-50 hover:text-ink",
                  )
                }
              >
                <Star className="h-4 w-4 flex-shrink-0 text-amber-400" />
                <span className="truncate">{p.name}</span>
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-100 p-2 space-y-0.5">
        <NavItem to="/profile" icon={Sparkles} label="Shadow PO AI" collapsed={collapsed} />
        <NavItem to="/settings" icon={Settings} label="Paramètres" collapsed={collapsed} />
      </div>
    </aside>
  );
}
