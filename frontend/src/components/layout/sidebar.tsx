import { FileText, FolderKanban, LayoutDashboard, MessageSquareText, Settings, Star } from "lucide-react";
import { NavLink } from "react-router-dom";
import { projects } from "../../data/mock-data";
import { cn } from "../../lib/utils";

const items = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/" },
  { label: "Suivi", icon: FolderKanban, to: "/projects/hcl-livret/spaces/s1-2026" },
  { label: "Documents", icon: FileText, to: "/projects/hcl-livret/spaces/s1-2026" },
  { label: "Let's Chat", icon: MessageSquareText, to: "/projects/hcl-livret/spaces/s1-2026" },
  { label: "Favoris", icon: Star, to: "/" },
  { label: "Parametres", icon: Settings, to: "/" },
];

export function Sidebar() {
  return (
    <aside className="hidden w-72 border-r border-white/10 bg-slate-950/70 px-4 py-5 backdrop-blur xl:block">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 font-semibold text-white">
          SP
        </div>
        <div>
          <p className="text-sm text-slate-400">Workspace</p>
          <h1 className="text-lg font-semibold">Shadow PO AI</h1>
        </div>
      </div>

      <nav className="space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-2xl px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white",
                isActive && "bg-white/10 text-white",
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-8">
        <p className="px-3 text-xs uppercase tracking-[0.2em] text-slate-500">Projets</p>
        <div className="mt-3 space-y-2">
          {projects.map((project) => (
            <NavLink
              key={project.id}
              to={`/projects/${project.id}`}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 transition hover:border-white/20 hover:bg-white/10"
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${project.color} text-sm font-semibold text-white`}>
                {project.icon}
              </div>
              <div>
                <p className="text-sm font-medium text-white">{project.name}</p>
                <p className="text-xs text-slate-400">{project.metrics.topics} topics</p>
              </div>
            </NavLink>
          ))}
        </div>
      </div>
    </aside>
  );
}
