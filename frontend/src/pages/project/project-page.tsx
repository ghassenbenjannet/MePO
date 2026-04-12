import { Link, useParams } from "react-router-dom";
import { PageHeader } from "../../components/ui/page-header";
import { SectionCard } from "../../components/ui/section-card";
import { documents, projects, spaces, topics } from "../../data/mock-data";

export function ProjectPage() {
  const { projectId } = useParams();
  const project = projects.find((item) => item.id === projectId);
  const projectSpaces = spaces.filter((space) => space.projectId === projectId);
  const recentTopics = topics.slice(0, 3);
  const recentDocuments = documents.slice(0, 3);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Project overview"
        title={project?.name ?? "Project"}
        description={project?.description ?? "Global product context, recent delivery signals, and access to spaces."}
        actions={<button className="rounded-2xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white">New space</button>}
      />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard title="Spaces" subtitle="Spaces organize releases, half-years, or strategic delivery scopes.">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projectSpaces.map((space) => (
              <Link
                key={space.id}
                to={`/projects/${space.projectId}/spaces/${space.id}`}
                className="rounded-[28px] border border-line bg-white p-5 transition hover:border-brand-200 hover:bg-slate-50"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-ink">{space.name}</h2>
                  <span className="rounded-full bg-brand-50 px-3 py-1 text-xs text-brand-600">{space.status}</span>
                </div>
                <p className="mt-2 text-sm text-muted">{space.timeframe}</p>
                <p className="mt-3 text-sm leading-6 text-muted">{space.summary}</p>
                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted">
                    <span>Progress</span>
                    <span>{space.progress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200">
                    <div className="h-2 rounded-full bg-gradient-to-r from-brand-500 to-accent-500" style={{ width: `${space.progress}%` }} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Recent topics" subtitle="Subjects that keep the project execution and memory coherent.">
            <div className="space-y-3">
              {recentTopics.map((topic) => (
                <Link
                  key={topic.id}
                  to={`/projects/${projectId}/spaces/${topic.spaceId}/topics/${topic.id}`}
                  className="block rounded-2xl border border-line bg-slate-50 p-4 transition hover:border-brand-200"
                >
                  <p className="text-sm font-semibold text-ink">{topic.title}</p>
                  <p className="mt-2 text-sm text-muted">{topic.description}</p>
                </Link>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Recent documents" subtitle="Key notes and analysis pages in the project context.">
            <div className="space-y-3">
              {recentDocuments.map((document) => (
                <div key={document.id} className="rounded-2xl border border-line bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-ink">{document.title}</p>
                  <p className="mt-2 text-xs text-muted">Updated {document.updatedAt}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
