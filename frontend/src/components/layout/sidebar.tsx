import {
  ChevronsUpDown,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LayoutPanelTop,
  ListChecks,
  ListTodo,
  LogOut,
  Map,
  Plus,
  Rows3,
  Search,
  Settings,
} from "lucide-react";
import type { ComponentType } from "react";
import { Link, NavLink, useLocation, useNavigate, useParams } from "react-router-dom";
import { useProjects } from "../../hooks/use-projects";
import { useSpaces } from "../../hooks/use-spaces";
import {
  projectPath,
  resolveEntityBySlug,
  spaceDocumentsPath,
  spaceOverviewPath,
  spaceSuiviPath,
} from "../../lib/routes";
import { cn } from "../../lib/utils";
import { initials, avatarGradient } from "../../lib/format";
import { useUiStore } from "../../stores/ui-store";
import { useAuthStore } from "../../stores/auth-store";

function SbNavItem({
  to,
  icon: Icon,
  label,
  collapsed,
  count,
  end = true,
}: {
  to: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  collapsed: boolean;
  count?: string;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          "group flex items-center gap-3 rounded-[10px] px-3 py-2 text-[12.5px] leading-none transition",
          collapsed && "justify-center px-0",
          isActive
            ? "bg-[var(--accent-soft)] text-[var(--accent-deep)]"
            : "text-[var(--ink-3)] hover:bg-[var(--paper)] hover:text-[var(--ink)]",
        )
      }
    >
      <Icon className="h-[15px] w-[15px] flex-shrink-0" />
      {!collapsed ? (
        <>
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {count ? (
            <span className="rounded-full bg-[var(--paper-2)] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink-5)]">
              {count}
            </span>
          ) : null}
        </>
      ) : null}
    </NavLink>
  );
}

function SbSpaceLink({
  to,
  label,
  active,
}: {
  to: string;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-2 rounded-[8px] px-3 py-1.5 text-[12px] transition",
        active
          ? "bg-[var(--accent-soft)] text-[var(--accent-deep)]"
          : "text-[var(--ink-4)] hover:bg-[var(--paper)] hover:text-[var(--ink)]",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full bg-[var(--rule)]", active && "bg-[var(--accent)]")} />
      <span className="min-w-0 truncate">{label}</span>
    </Link>
  );
}

function SbSubLink({
  to,
  icon: Icon,
  label,
  active,
}: {
  to: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-2 rounded-[8px] px-3 py-1.5 text-[11.5px] transition",
        active
          ? "bg-[var(--paper-2)] text-[var(--ink)]"
          : "text-[var(--ink-4)] hover:bg-[var(--paper)] hover:text-[var(--ink)]",
      )}
    >
      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function Sidebar({
  onOpenCommandPalette,
}: {
  onOpenCommandPalette: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectSlug, spaceSlug } = useParams<{
    projectSlug?: string;
    spaceSlug?: string;
  }>();

  const { data: projects = [] } = useProjects();
  const activeProject = resolveEntityBySlug(projects, projectSlug);
  const projectId = activeProject?.id;
  const { data: projectSpaces = [] } = useSpaces(projectId);
  const activeSpace = resolveEntityBySlug(projectSpaces, spaceSlug);
  const spaceId = activeSpace?.id;

  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const userInitials = user?.full_name ? initials(user.full_name) : "?";
  const userGradient = avatarGradient(user?.full_name ?? "MePO");
  const displayProjects = projects.slice(0, 8);
  const currentSuiviView = new URLSearchParams(location.search).get("view") ?? "overview";
  const isSuiviPath = location.pathname.endsWith("/suivi");
  const projectRef = activeProject ?? { id: projectId ?? "", name: projectSlug ?? "" };
  const spaceRef = activeSpace ?? { id: spaceId ?? "", name: spaceSlug ?? "" };
  const favoriteKanbanLink = activeSpace
    ? spaceSuiviPath(projectRef, spaceRef, "kanban")
    : "/";
  const favoriteDocumentsLink = activeSpace
    ? spaceDocumentsPath(projectRef, spaceRef)
    : "/";

  return (
    <aside
      className={cn(
        "hidden flex-shrink-0 border-r border-[var(--rule)] bg-[var(--paper-2)] xl:flex",
        collapsed ? "w-[78px]" : "w-[280px]",
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col px-4 py-4">
        <button
          type="button"
          onClick={() => navigate("/")}
          className={cn(
            "flex items-center gap-3 rounded-[14px] border border-[var(--rule)] bg-[var(--paper)] px-4 py-4 text-left shadow-[var(--shadow-xs)] transition hover:border-[var(--ink-5)]",
            collapsed && "justify-center px-0",
          )}
        >
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-[var(--accent)] text-[22px] leading-none text-white shadow-[var(--shadow-xs)]">
            <span className="font-display italic">M</span>
          </span>
          {!collapsed ? (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold text-[var(--ink)]">MePO</span>
                <span className="block truncate text-[11px] text-[var(--ink-4)]">
                  {activeProject?.name ?? "Equipe produit"}
                </span>
              </span>
              <ChevronsUpDown className="h-4 w-4 flex-shrink-0 text-[var(--ink-5)]" />
            </>
          ) : null}
        </button>

        {!collapsed ? (
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="mt-4 flex items-center gap-2 rounded-[12px] border border-[var(--rule)] bg-[var(--paper)] px-3 py-2.5 text-left text-[12.5px] text-[var(--ink-4)] shadow-[var(--shadow-xs)] transition hover:border-[var(--ink-5)] hover:text-[var(--ink)]"
          >
            <Search className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="min-w-0 flex-1 truncate">Rechercher...</span>
            <span className="rounded border border-[var(--rule)] bg-[var(--paper-2)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--ink-5)]">
              Ctrl K
            </span>
          </button>
        ) : null}

        <div className="mt-5 flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="space-y-1">
            <SbNavItem to="/" icon={LayoutDashboard} label="Cockpit" collapsed={collapsed} end />
          </div>

          <div className="mt-6">
            {!collapsed ? (
              <div className="mb-2 flex items-center justify-between px-2">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--ink-5)]">Portefeuille</span>
                <button
                  type="button"
                  onClick={() => navigate("/")}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-[var(--ink-5)] transition hover:bg-[var(--paper)] hover:text-[var(--ink)]"
                  title="Nouveau projet"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}

            <div className="space-y-1">
              {displayProjects.map((project) => {
                const isActiveProject = project.id === projectId;
                const projectLetter = initials(project.name).charAt(0);

                return (
                  <div key={project.id} className="space-y-1">
                    <NavLink
                      to={projectPath(project)}
                      title={collapsed ? project.name : undefined}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 rounded-[10px] px-3 py-2 text-[12.5px] transition",
                          collapsed && "justify-center px-0",
                          isActive || isActiveProject
                            ? "bg-[var(--accent-soft)] text-[var(--accent-deep)]"
                            : "text-[var(--ink-3)] hover:bg-[var(--paper)] hover:text-[var(--ink)]",
                        )
                      }
                    >
                      <span
                        className={cn(
                          "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[8px] border border-[var(--rule)] bg-[var(--paper)] font-mono text-[10px] font-semibold text-[var(--ink-4)]",
                          isActiveProject && "border-[var(--accent-soft)] bg-[var(--paper)] text-[var(--accent-deep)]",
                        )}
                      >
                        {projectLetter}
                      </span>
                      {!collapsed ? (
                        <span className="min-w-0 flex-1 truncate">{project.name}</span>
                      ) : null}
                    </NavLink>

                    {!collapsed && isActiveProject && projectSpaces.length > 0 ? (
                      <div className="ml-5 space-y-1 border-l border-[var(--rule)] pl-3">
                        {projectSpaces.map((space) => {
                          const isActiveSpace = space.id === spaceId;
                          const activeProjectRef = project;
                          const activeSpaceRef = space;
                          return (
                            <div key={space.id} className="space-y-1">
                              <SbSpaceLink
                                to={spaceOverviewPath(activeProjectRef, activeSpaceRef)}
                                label={space.name}
                                active={isActiveSpace}
                              />

                              {isActiveSpace ? (
                                <div className="ml-3 space-y-1 border-l border-[var(--rule)] pl-3">
                                  <SbSubLink
                                    to={spaceSuiviPath(activeProjectRef, activeSpaceRef, "overview")}
                                    icon={LayoutPanelTop}
                                    label="Cockpit"
                                    active={isSuiviPath && currentSuiviView === "overview"}
                                  />
                                  <SbSubLink
                                    to={spaceSuiviPath(activeProjectRef, activeSpaceRef, "topics")}
                                    icon={Rows3}
                                    label="Topics"
                                    active={isSuiviPath && currentSuiviView === "topics"}
                                  />
                                  <SbSubLink
                                    to={spaceSuiviPath(activeProjectRef, activeSpaceRef, "kanban")}
                                    icon={FolderKanban}
                                    label="Kanban"
                                    active={isSuiviPath && currentSuiviView === "kanban"}
                                  />
                                  <SbSubLink
                                    to={spaceSuiviPath(activeProjectRef, activeSpaceRef, "tasks")}
                                    icon={ListChecks}
                                    label="Taches"
                                    active={isSuiviPath && currentSuiviView === "tasks"}
                                  />
                                  <SbSubLink
                                    to={spaceSuiviPath(activeProjectRef, activeSpaceRef, "backlog")}
                                    icon={ListTodo}
                                    label="Backlog"
                                    active={isSuiviPath && currentSuiviView === "backlog"}
                                  />
                                  <SbSubLink
                                    to={spaceSuiviPath(activeProjectRef, activeSpaceRef, "roadmap")}
                                    icon={Map}
                                    label="Roadmap"
                                    active={isSuiviPath && currentSuiviView === "roadmap"}
                                  />
                                  <SbSubLink
                                    to={spaceDocumentsPath(activeProjectRef, activeSpaceRef)}
                                    icon={FileText}
                                    label="Documents"
                                    active={location.pathname.endsWith("/documents")}
                                  />
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          {!collapsed && activeSpace ? (
            <div className="mt-6">
              <div className="mb-2 px-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--ink-5)]">
                Favoris
              </div>
              <div className="space-y-1">
                <SbNavItem to={favoriteDocumentsLink} icon={FileText} label="Documents" collapsed={false} end={false} />
                <SbNavItem to={favoriteKanbanLink} icon={FolderKanban} label="Projet Actif" collapsed={false} end={false} />
              </div>
            </div>
          ) : null}

          <div className="mt-auto pt-5">
            <SbNavItem to="/settings" icon={Settings} label="Parametres" collapsed={collapsed} />
          </div>
        </div>

        <div className="mt-4 border-t border-[var(--rule)] pt-4">
          {collapsed ? (
            <button
              type="button"
              onClick={() => navigate("/profile")}
              title={user?.full_name ?? "Profil"}
              className={cn(
                "mx-auto flex h-10 w-10 items-center justify-center rounded-full text-[11px] font-bold text-white transition hover:scale-[1.04]",
                `bg-gradient-to-br ${userGradient}`,
              )}
            >
              {userInitials}
            </button>
          ) : (
            <div className="flex items-center gap-3 rounded-[12px] border border-[var(--rule)] bg-[var(--paper)] px-3 py-2.5 shadow-[var(--shadow-xs)]">
              <button
                type="button"
                onClick={() => navigate("/profile")}
                className={cn(
                  "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white",
                  `bg-gradient-to-br ${userGradient}`,
                )}
              >
                {userInitials}
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold text-[var(--ink)]">
                  {user?.full_name ?? "Utilisateur"}
                </p>
                <p className="truncate text-[10.5px] text-[var(--ink-4)]">
                  {user?.email ?? "Product Manager"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  logout();
                  navigate("/login");
                }}
                title="Se deconnecter"
                className="flex h-8 w-8 items-center justify-center rounded-[10px] text-[var(--ink-4)] transition hover:bg-[var(--paper-2)] hover:text-[var(--hot)]"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
