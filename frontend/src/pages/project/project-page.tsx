import { Link, useParams } from "react-router-dom";
import { SectionCard } from "../../components/ui/section-card";
import { spaces } from "../../data/mock-data";

export function ProjectPage() {
  const { projectId } = useParams();
  const projectSpaces = spaces.filter((space) => space.projectId === projectId);

  return (
    <div className="space-y-6">
      <SectionCard
        title="Project spaces"
        subtitle="Spaces organize releases, half-years, or strategic delivery scopes."
        action={<button className="rounded-2xl bg-white px-4 py-2 text-sm font-medium text-slate-950">New space</button>}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projectSpaces.map((space) => (
            <Link
              key={space.id}
              to={`/projects/${space.projectId}/spaces/${space.id}`}
              className="rounded-3xl border border-white/10 bg-white/5 p-5 transition hover:border-white/20 hover:bg-white/10"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">{space.name}</h2>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">{space.status}</span>
              </div>
              <p className="mt-2 text-sm text-slate-400">{space.timeframe}</p>
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-500">
                  <span>Progress</span>
                  <span>{space.progress}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800">
                  <div className="h-2 rounded-full bg-gradient-to-r from-brand-500 to-accent-500" style={{ width: `${space.progress}%` }} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
