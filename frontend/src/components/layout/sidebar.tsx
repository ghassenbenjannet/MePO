import {
  ChevronDown,
  FolderOpen,
  Home,
  Layers,
  MessageSquareText,
  Settings,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { Link, NavLink, useLocation, useParams } from "react-router-dom";
import { useProjects } from "../../hooks/use-projects";
import { useSpaces } from "../../hooks/use-spaces";
import { cn } from "../../lib/utils";

export function Sidebar() {
  const location = useLocation();
  const { projectId } = useParams();
  const [spacesOpen, setSpacesOpen] = useState(true);

  const { data: projects = [] } = useProjects();
  const { data: spaces = [] } = useSpaces(projectId);
  const currentProject = projects.find((p) => p.id === projectId);

  const inProject = location.pathname.startsWith("/projects/");

  return (
    <aside className="hidden w-60 flex-shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-panel)] xl:flex">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b border-[var(--border)] px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <span className="text-sm font-bold text-[var(--text-strong)]">Shadow PO AI</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        {/* Global nav */}
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition",
              isActive
                ? "bg-brand-500/10 font-semibold text-brand-500"
                : "text-[var(--text-muted)] hover:bg-[var(--bg-panel-2)] hover:text-[var(--text-strong)]",
            )
          }
        >
          <Home className="h-4 w-4 flex-shrink-0" />
          Accueil
        </NavLink>

        {/* Project context */}
        {inProject && currentProject && (
          <>
            <div className="mt-3 mb-1 px-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                Projet
              </p>
            </div>

            <Link
              to={`/projects/${currentProject.id}`}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-semibold text-[var(--text-strong)] hover:bg-[var(--bg-panel-2)]"
            >
              <div
                className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-gradient-to-br ${currentProject.color} text-[10px] font-bold text-white`}
              >
                {currentProject.icon}
              </div>
              <span className="truncate">{currentProject.name}</span>
            </Link>

            {/* Spaces */}
            {spaces.length > 0 && (
              <div className="mt-1">
                <button
                  onClick={() => setSpacesOpen((v) => !v)}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)] hover:bg-[var(--bg-panel-2)] hover:text-[var(--text-strong)]"
                >
                  <ChevronDown
                    className={cn("h-3.5 w-3.5 transition-transform", !spacesOpen && "-rotate-90")}
                  />
                  Espaces
                </button>
                {spacesOpen &&
                  spaces.map((space) => (
                    <NavLink
                      key={space.id}
                      to={`/projects/${projectId}/spaces/${space.id}`}
                      className={({ isActive }) =>
                        cn(
                          "ml-3 flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition",
                          isActive
                            ? "bg-brand-500/10 font-medium text-brand-500"
                            : "text-[var(--text-muted)] hover:bg-[var(--bg-panel-2)] hover:text-[var(--text-strong)]",
                        )
                      }
                    >
                      <FolderOpen className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{space.name}</span>
                      <span
                        className={cn(
                          "ml-auto rounded px-1 py-0.5 text-[10px] font-medium",
                          space.status === "active"
                            ? "bg-accent-500/15 text-accent-500"
                            : "bg-[var(--bg-panel-2)] text-[var(--text-muted)]",
                        )}
                      >
                        {space.status}
                      </span>
                    </NavLink>
                  ))}
              </div>
            )}

            <div className="mt-1 border-t border-[var(--border)] pt-1">
              {[
                { label: "Documents", icon: Layers, to: `/projects/${projectId}` },
                { label: "Let's Chat", icon: MessageSquareText, to: `/projects/${projectId}` },
              ].map((item) => (
                <NavLink
                  key={item.label}
                  to={item.to}
                  className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-[var(--text-muted)] transition hover:bg-[var(--bg-panel-2)] hover:text-[var(--text-strong)]"
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </>
        )}

        {/* All projects */}
        {!inProject && (
          <>
            <div className="mt-3 mb-1 px-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                Mes projets
              </p>
            </div>
            {projects.map((project) => (
              <NavLink
                key={project.id}
                to={`/projects/${project.id}`}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition",
                    isActive
                      ? "bg-brand-500/10 font-semibold text-brand-500"
                      : "text-[var(--text-muted)] hover:bg-[var(--bg-panel-2)] hover:text-[var(--text-strong)]",
                  )
                }
              >
                <div
                  className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-gradient-to-br ${project.color} text-[10px] font-bold text-white`}
                >
                  {project.icon}
                </div>
                <span className="truncate">{project.name}</span>
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* Bottom */}
      <div className="border-t border-[var(--border)] p-2">
        <NavLink
          to="/settings"
          className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-[var(--text-muted)] transition hover:bg-[var(--bg-panel-2)] hover:text-[var(--text-strong)]"
        >
          <Settings className="h-4 w-4" />
          Paramètres
        </NavLink>
      </div>
    </aside>
  );
}
