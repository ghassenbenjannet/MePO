import { FileText, FolderKanban, LayoutDashboard, MessageSquareText, Settings, Sparkles, Star } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { projects } from "../../data/mock-data";
import { cn } from "../../lib/utils";

const items = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/" },
  { label: "Projets", icon: FolderKanban, to: "/projects/hcl-livret" },
  { label: "Favoris", icon: Star, to: "/" },
  { label: "Parametres", icon: Settings, to: "/" },
];

export function Sidebar() {
  const location = useLocation();
  const inProjectContext = location.pathname.startsWith("/projects/");

  return (
    <aside className="hidden w-72 border-r border-line bg-white/80 px-4 py-5 backdrop-blur xl:block">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 font-semibold text-white shadow-panel">
          SP
        </div>
        <div>
          <p className="text-sm text-muted">Workspace</p>
          <h1 className="text-lg font-semibold text-ink">Shadow PO AI</h1>
        </div>
      </div>

      <nav className="space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-muted transition hover:bg-slate-50 hover:text-ink",
                isActive && "bg-brand-50 text-brand-600",
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {inProjectContext ? (
        <div className="mt-8">
          <p className="px-3 text-xs uppercase tracking-[0.2em] text-muted">Projet courant</p>
          <div className="mt-3 space-y-1">
            {[
              { label: "Espaces", icon: FolderKanban, to: "/projects/hcl-livret" },
              { label: "Suivi", icon: FolderKanban, to: "/projects/hcl-livret/spaces/s1-2026" },
              { label: "Documents", icon: FileText, to: "/projects/hcl-livret/spaces/s1-2026" },
              { label: "Let's Chat", icon: MessageSquareText, to: "/projects/hcl-livret/spaces/s1-2026" },
              { label: "Imports", icon: Sparkles, to: "/projects/hcl-livret" },
            ].map((item) => (
              <NavLink
                key={item.label}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-muted transition hover:bg-slate-50 hover:text-ink",
                    isActive && "bg-accent-50 text-accent-600",
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-8">
        <p className="px-3 text-xs uppercase tracking-[0.2em] text-muted">Projets</p>
        <div className="mt-3 space-y-2">
          {projects.map((project) => (
            <NavLink
              key={project.id}
              to={`/projects/${project.id}`}
              className="flex items-center gap-3 rounded-2xl border border-line bg-white px-3 py-3 transition hover:border-brand-200 hover:bg-slate-50"
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${project.color} text-sm font-semibold text-white`}>
                {project.icon}
              </div>
              <div>
                <p className="text-sm font-medium text-ink">{project.name}</p>
                <p className="text-xs text-muted">{project.metrics.topics} topics</p>
              </div>
            </NavLink>
          ))}
        </div>
      </div>
    </aside>
  );
}
