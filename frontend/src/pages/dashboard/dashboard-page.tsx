import { ArrowRight, Loader2, Plus, Rocket } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useCreateProject, useProjects } from "../../hooks/use-projects";

// ─── New project modal (inline, minimal) ─────────────────────────────────────
const COLORS = [
  { label: "Indigo", value: "from-indigo-500 to-purple-600" },
  { label: "Blue", value: "from-blue-500 to-cyan-500" },
  { label: "Emerald", value: "from-emerald-500 to-teal-500" },
  { label: "Orange", value: "from-orange-500 to-red-500" },
  { label: "Pink", value: "from-pink-500 to-rose-600" },
];

function NewProjectModal({ onClose }: { onClose: () => void }) {
  const { mutateAsync, isPending } = useCreateProject();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [icon, setIcon] = useState("P");
  const [color, setColor] = useState(COLORS[0].value);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await mutateAsync({ name, description: desc || null, icon, color });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-6 shadow-float">
        <h2 className="text-base font-bold text-[var(--text-strong)]">Nouveau projet</h2>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div>
            <label className="label">Nom du projet *</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex : HCL — Livret"
              className="input"
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={2}
              placeholder="Contexte rapide…"
              className="input resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Icône (1-2 car.)</label>
              <input
                value={icon}
                onChange={(e) => setIcon(e.target.value.slice(0, 2))}
                maxLength={2}
                className="input text-center font-bold"
              />
            </div>
            <div>
              <label className="label">Couleur</label>
              <div className="flex gap-2 mt-1.5">
                {COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    className={`h-6 w-6 rounded-full bg-gradient-to-br ${c.value} ring-offset-2 ring-offset-[var(--bg-panel)] transition ${color === c.value ? "ring-2 ring-brand-500" : ""}`}
                  />
                ))}
              </div>
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

// ─── Page ─────────────────────────────────────────────────────────────────────
export function DashboardPage() {
  const { data: projects = [], isLoading } = useProjects();
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      {showModal && <NewProjectModal onClose={() => setShowModal(false)} />}

      <div className="mx-auto max-w-6xl space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[var(--text-strong)]">Mes projets</h1>
            <p className="mt-0.5 text-sm text-[var(--text-muted)]">
              {projects.length} projet{projects.length !== 1 ? "s" : ""} — sélectionne un workspace PO
            </p>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <Plus className="h-4 w-4" />
            Nouveau projet
          </button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-20 text-[var(--text-muted)]">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Chargement…
          </div>
        )}

        {/* Empty state */}
        {!isLoading && projects.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-[var(--border)] py-20 text-center">
            <Rocket className="h-10 w-10 text-[var(--text-muted)]" />
            <div>
              <p className="font-semibold text-[var(--text-strong)]">Aucun projet pour l'instant</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Lance ton premier projet Shadow PO</p>
            </div>
            <button onClick={() => setShowModal(true)} className="btn-primary">
              <Plus className="h-4 w-4" />
              Créer mon premier projet
            </button>
          </div>
        )}

        {/* Project grid */}
        {!isLoading && projects.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="group flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] transition hover:border-brand-500/50 hover:shadow-panel"
              >
                {/* Color stripe */}
                <div className={`h-1 bg-gradient-to-r ${project.color}`} />
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${project.color} text-sm font-bold text-white`}
                    >
                      {project.icon}
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-bold text-[var(--text-strong)]">
                        {project.name}
                      </h2>
                      {project.created_at && (
                        <p className="text-xs text-[var(--text-muted)]">
                          {new Date(project.created_at).toLocaleDateString("fr-FR")}
                        </p>
                      )}
                    </div>
                  </div>

                  {project.description && (
                    <p className="mt-3 line-clamp-2 text-sm text-[var(--text-muted)]">
                      {project.description}
                    </p>
                  )}

                  <div className="mt-auto pt-4 flex items-center justify-between">
                    <span className="text-xs text-[var(--text-muted)]">Ouvrir le projet</span>
                    <ArrowRight className="h-4 w-4 text-[var(--text-muted)] transition group-hover:translate-x-1 group-hover:text-brand-500" />
                  </div>
                </div>
              </Link>
            ))}

            {/* Add project card */}
            <button
              onClick={() => setShowModal(true)}
              className="group flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--border)] bg-transparent transition hover:border-brand-500/50 hover:bg-brand-500/5"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-dashed border-[var(--border)] transition group-hover:border-brand-500/50 group-hover:bg-brand-500/10">
                <Plus className="h-5 w-5 text-[var(--text-muted)] group-hover:text-brand-500" />
              </div>
              <p className="text-sm font-medium text-[var(--text-muted)] group-hover:text-brand-500">
                Nouveau projet
              </p>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
