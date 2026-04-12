import { ArrowRight, Loader2, Plus, FolderOpen } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useProject } from "../../hooks/use-projects";
import { useSpaces, useCreateSpace } from "../../hooks/use-spaces";
import { useTopics } from "../../hooks/use-topics";
import { cn } from "../../lib/utils";
import type { Space } from "../../types/domain";

// ─── Status badge ─────────────────────────────────────────────────────────────
const statusStyle: Record<string, string> = {
  active:   "bg-accent-500/15 text-accent-500",
  planning: "bg-brand-500/15 text-brand-500",
  closed:   "bg-[var(--bg-panel-2)] text-[var(--text-muted)]",
};

// ─── New space modal ──────────────────────────────────────────────────────────
function NewSpaceModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const { mutateAsync, isPending } = useCreateSpace();
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await mutateAsync({
      project_id: projectId,
      name,
      summary: summary || null,
      start_date: startDate || null,
      end_date: endDate || null,
      status: "planning",
      progress: 0,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-6 shadow-float">
        <h2 className="text-base font-bold text-[var(--text-strong)]">Nouvel espace</h2>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div>
            <label className="label">Nom *</label>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Ex : Semestre 1 2026" className="input" />
          </div>
          <div>
            <label className="label">Résumé</label>
            <textarea value={summary} onChange={(e) => setSummary(e.target.value)}
              rows={2} placeholder="Périmètre, objectifs…" className="input resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date début</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">Date fin</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" disabled={isPending || !name.trim()} className="btn-primary">
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Créer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Space card ───────────────────────────────────────────────────────────────
function SpaceCard({ space, projectId }: { space: Space; projectId: string }) {
  const timeframe =
    space.start_date && space.end_date
      ? `${new Date(space.start_date).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })} → ${new Date(space.end_date).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}`
      : space.start_date
        ? `Depuis ${new Date(space.start_date).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}`
        : null;

  return (
    <Link
      to={`/projects/${projectId}/spaces/${space.id}`}
      className="group flex flex-col rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-5 transition hover:border-brand-500/50 hover:shadow-panel"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 flex-shrink-0 text-brand-500" />
          <h3 className="font-semibold text-[var(--text-strong)]">{space.name}</h3>
        </div>
        <span className={cn("badge flex-shrink-0 capitalize", statusStyle[space.status] ?? statusStyle.planning)}>
          {space.status}
        </span>
      </div>

      {timeframe && <p className="mt-1 text-xs text-[var(--text-muted)]">{timeframe}</p>}
      {space.summary && (
        <p className="mt-2 line-clamp-2 text-sm text-[var(--text-muted)]">{space.summary}</p>
      )}

      {/* Progress */}
      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs text-[var(--text-muted)]">
          <span>Progression</span>
          <span className="font-semibold text-[var(--text-strong)]">{space.progress}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-panel-2)]">
          <div
            className="h-1.5 rounded-full bg-gradient-to-r from-brand-500 to-accent-500 transition-all"
            style={{ width: `${space.progress}%` }}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] group-hover:text-brand-500">
        Ouvrir l'espace
        <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [showModal, setShowModal] = useState(false);

  const { data: project, isLoading: loadingProject } = useProject(projectId);
  const { data: spaces = [], isLoading: loadingSpaces } = useSpaces(projectId);
  const { data: topics = [] } = useTopics(undefined); // recent across project (no space filter)

  const loading = loadingProject || loadingSpaces;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-[var(--text-muted)]">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Chargement…
      </div>
    );
  }

  return (
    <>
      {showModal && projectId && (
        <NewSpaceModal projectId={projectId} onClose={() => setShowModal(false)} />
      )}

      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="section-title">Projet</p>
            <h1 className="mt-1 text-xl font-bold text-[var(--text-strong)]">
              {project?.name ?? "…"}
            </h1>
            {project?.description && (
              <p className="mt-0.5 text-sm text-[var(--text-muted)]">{project.description}</p>
            )}
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <Plus className="h-4 w-4" />
            Nouvel espace
          </button>
        </div>

        {/* Spaces */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-[var(--text-strong)]">
              Espaces{" "}
              <span className="ml-1 rounded bg-[var(--bg-panel-2)] px-1.5 py-0.5 text-xs text-[var(--text-muted)]">
                {spaces.length}
              </span>
            </h2>
          </div>

          {spaces.length === 0 ? (
            <button
              onClick={() => setShowModal(true)}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--border)] py-12 text-center transition hover:border-brand-500/50 hover:bg-brand-500/5"
            >
              <Plus className="h-7 w-7 text-[var(--text-muted)]" />
              <p className="text-sm font-medium text-[var(--text-muted)]">Créer le premier espace</p>
            </button>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {spaces.map((space) => (
                <SpaceCard key={space.id} space={space} projectId={projectId!} />
              ))}
              {/* Add space */}
              <button
                onClick={() => setShowModal(true)}
                className="group flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--border)] transition hover:border-brand-500/50 hover:bg-brand-500/5"
              >
                <Plus className="h-6 w-6 text-[var(--text-muted)] group-hover:text-brand-500" />
                <span className="text-sm font-medium text-[var(--text-muted)] group-hover:text-brand-500">
                  Nouvel espace
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Recent topics */}
        {topics.length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-bold text-[var(--text-strong)]">Sujets récents</h2>
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    {["Titre", "Statut", "Priorité", "Owner"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--text-muted)]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topics.slice(0, 6).map((t) => (
                    <tr key={t.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-panel-2)]">
                      <td className="px-4 py-2.5 font-medium text-[var(--text-strong)]">{t.title}</td>
                      <td className="px-4 py-2.5">
                        <span className={cn("badge capitalize", t.status === "active" ? "bg-accent-500/15 text-accent-500" : t.status === "blocked" ? "bg-danger-500/15 text-danger-500" : "bg-[var(--bg-panel-2)] text-[var(--text-muted)]")}>
                          {t.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={cn("badge capitalize", t.priority === "critical" || t.priority === "high" ? "bg-warn-500/15 text-warn-500" : "bg-[var(--bg-panel-2)] text-[var(--text-muted)]")}>
                          {t.priority}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[var(--text-muted)]">{t.owner ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
