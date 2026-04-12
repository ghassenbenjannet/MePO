import { ArrowRight, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { SectionCard } from "../../components/ui/section-card";
import { projects } from "../../data/mock-data";

export function DashboardPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-8 shadow-soft">
        <div className="max-w-3xl">
          <p className="text-sm uppercase tracking-[0.3em] text-brand-100">Product operations cockpit</p>
          <h1 className="mt-3 text-4xl font-semibold text-white">
            A unified workspace for tracking, documentation, and AI-assisted product delivery.
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-300">
            Shadow PO AI brings Jira-style execution, Confluence-style knowledge, and ChatGPT-powered assistance into one coherent product workspace.
          </p>
          <div className="mt-6 flex gap-3">
            <button className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-medium text-slate-950">
              <Plus className="h-4 w-4" />
              Create project
            </button>
            <button className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-medium text-white">
              Import from Jira or Confluence
            </button>
          </div>
        </div>
      </section>

      <SectionCard title="My projects" subtitle="Prioritized product spaces with tracking, documentation, and AI context.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className="group rounded-3xl border border-white/10 bg-white/5 p-5 transition hover:border-white/20 hover:bg-white/10"
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${project.color} text-sm font-semibold text-white`}>
                {project.icon}
              </div>
              <h2 className="mt-4 text-lg font-semibold text-white">{project.name}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">{project.description}</p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-300">
                <div className="rounded-2xl bg-slate-950/50 p-3">{project.metrics.topics} topics</div>
                <div className="rounded-2xl bg-slate-950/50 p-3">{project.metrics.tickets} tickets</div>
                <div className="rounded-2xl bg-slate-950/50 p-3">{project.metrics.documents} docs</div>
                <div className="rounded-2xl bg-slate-950/50 p-3">{project.metrics.spaces} spaces</div>
              </div>
              <div className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-brand-100">
                Open project
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
