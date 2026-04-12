import { ArrowRight, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { KpiCard } from "../../components/ui/kpi-card";
import { PageHeader } from "../../components/ui/page-header";
import { SectionCard } from "../../components/ui/section-card";
import { projects } from "../../data/mock-data";

export function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dashboard"
        title="A clear Product Owner workspace built for execution."
        description="Track project priorities, enter a space quickly, and move from backlog to documentation to AI without losing context."
        actions={
          <>
            <button className="inline-flex items-center gap-2 rounded-2xl bg-brand-500 px-5 py-3 text-sm font-medium text-white">
              <Plus className="h-4 w-4" />
              Create project
            </button>
            <button className="rounded-2xl border border-line bg-white px-5 py-3 text-sm font-medium text-ink">
              Import from Jira or Confluence
            </button>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Projects" value="4" detail="Actively followed PO workspaces" />
        <KpiCard label="Topics" value="29" detail="Structured business and technical subjects" />
        <KpiCard label="Open tickets" value="83" detail="Filtered execution load across spaces" />
        <KpiCard label="Recent docs" value="17" detail="Updated notes, analyses, and recipes" />
      </section>

      <SectionCard title="My projects" subtitle="Prioritized product spaces with tracking, documentation, and AI context.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className="group rounded-[28px] border border-line bg-white p-5 transition hover:border-brand-200 hover:bg-slate-50"
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${project.color} text-sm font-semibold text-white`}>
                {project.icon}
              </div>
              <h2 className="mt-4 text-lg font-semibold text-ink">{project.name}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{project.description}</p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-ink">
                <div className="rounded-2xl bg-slate-50 p-3">{project.metrics.topics} topics</div>
                <div className="rounded-2xl bg-slate-50 p-3">{project.metrics.tickets} tickets</div>
                <div className="rounded-2xl bg-slate-50 p-3">{project.metrics.documents} docs</div>
                <div className="rounded-2xl bg-slate-50 p-3">{project.metrics.spaces} spaces</div>
              </div>
              <p className="mt-4 text-xs uppercase tracking-[0.2em] text-muted">{project.lastActivity}</p>
              <div className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-brand-600">
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
