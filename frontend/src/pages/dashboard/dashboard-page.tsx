import { ArrowRight, ImagePlus, Loader2, Pencil, Plus, Rocket, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCreateProject, useDeleteProject, useProjects, useUpdateProject } from "../../hooks/use-projects";
import { useUiStore } from "../../stores/ui-store";
import type { Project } from "../../types/domain";

const PROJECT_STATUSES = [
  { value: "active", label: "Actif" },
  { value: "planning", label: "En preparation" },
  { value: "archived", label: "Archive" },
];

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function statusBadge(status: string) {
  if (status === "active") return "bg-emerald-50 text-emerald-700";
  if (status === "planning") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

function ProjectModal({
  project,
  onClose,
}: {
  project?: Project;
  onClose: () => void;
}) {
  const { mutateAsync: createProject, isPending: creating } = useCreateProject();
  const { mutateAsync: updateProject, isPending: updating } = useUpdateProject();
  const [name, setName] = useState(project?.name ?? "");
  const [status, setStatus] = useState(project?.status ?? "active");
  const [description, setDescription] = useState(project?.description ?? "");
  const [imageUrl, setImageUrl] = useState(project?.image_url ?? "");
  const [errorMessage, setErrorMessage] = useState("");

  const isEdit = Boolean(project);
  const isPending = creating || updating;
  const isValid = useMemo(() => name.trim().length > 0, [name]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!isValid) return;
    setErrorMessage("");

    try {
      if (project) {
        await updateProject({
          id: project.id,
          name: name.trim(),
          status,
          description: description.trim() || null,
          image_url: imageUrl.trim() || null,
        });
      } else {
        await createProject({
          name: name.trim(),
          status,
          description: description.trim() || null,
          image_url: imageUrl.trim() || null,
        });
      }
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Impossible d'enregistrer le projet.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[28px] border border-line bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-brand-600">
              {isEdit ? "Edition projet" : "Nouveau projet"}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-ink">
              {isEdit ? "Modifier le projet" : "Creer un projet"}
            </h2>
            <p className="mt-2 text-sm text-muted">Nom, statut, description et image du projet.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-muted transition hover:bg-slate-50"
          >
            Fermer
          </button>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-ink">Nom du projet *</label>
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex : HCL - Livret"
              className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-ink">Statut</label>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
            >
              {PROJECT_STATUSES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-ink">Description</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="Contexte, client, perimetre..."
              className="w-full resize-none rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-ink">Image</label>
            <div className="flex items-center gap-3 rounded-2xl border border-line bg-slate-50 px-4 py-3">
              <ImagePlus className="h-4 w-4 text-muted" />
              <input
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
                placeholder="URL d'image optionnelle"
                className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
              />
            </div>
          </div>

          {errorMessage ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium text-ink transition hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!isValid || isPending}
              className="inline-flex items-center gap-2 rounded-2xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {isEdit ? "Enregistrer" : "Creer le projet"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteProjectModal({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  const { mutateAsync: deleteProject, isPending } = useDeleteProject();
  const [errorMessage, setErrorMessage] = useState("");

  async function confirmDelete() {
    setErrorMessage("");
    try {
      await deleteProject(project.id);
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Impossible de supprimer le projet.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] border border-line bg-white p-6 shadow-2xl">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-rose-600">Suppression</p>
        <h2 className="mt-2 text-xl font-semibold text-ink">Supprimer le projet</h2>
        <p className="mt-3 text-sm leading-6 text-muted">
          Le projet <strong>{project.name}</strong> et ses donnees descendantes seront supprimes.
        </p>

        {errorMessage ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium text-ink transition hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={confirmDelete}
            className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { data: projects = [], isLoading } = useProjects();
  const createProjectModalOpen = useUiStore((state) => state.createProjectModalOpen);
  const setCreateProjectModalOpen = useUiStore((state) => state.setCreateProjectModalOpen);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(createProjectModalOpen);

  useEffect(() => {
    setShowCreateModal(createProjectModalOpen);
  }, [createProjectModalOpen]);

  return (
    <>
      {showCreateModal ? (
        <ProjectModal
          onClose={() => {
            setShowCreateModal(false);
            setCreateProjectModalOpen(false);
          }}
        />
      ) : null}

      {editingProject ? (
        <ProjectModal project={editingProject} onClose={() => setEditingProject(null)} />
      ) : null}

      {deletingProject ? (
        <DeleteProjectModal project={deletingProject} onClose={() => setDeletingProject(null)} />
      ) : null}

      <div className="mx-auto max-w-6xl space-y-8">
        <section className="rounded-[32px] border border-line bg-white p-8 shadow-panel">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-brand-600">Accueil</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Mes projets</h1>
            </div>
            <button
              onClick={() => {
                setShowCreateModal(true);
                setCreateProjectModalOpen(true);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-600"
            >
              <Plus className="h-4 w-4" />
              Creer un projet
            </button>
          </div>
        </section>

        {isLoading ? (
          <div className="flex items-center justify-center rounded-[28px] border border-line bg-white py-20 text-muted shadow-panel">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Chargement des projets...
          </div>
        ) : null}

        {!isLoading && projects.length === 0 ? (
          <section className="flex flex-col items-center justify-center gap-4 rounded-[28px] border-2 border-dashed border-line bg-white py-20 text-center shadow-panel">
            <Rocket className="h-10 w-10 text-muted" />
            <div>
              <p className="text-base font-semibold text-ink">Aucun projet pour l'instant</p>
              <p className="mt-2 text-sm text-muted">Cree ton premier projet pour structurer ton workspace PO.</p>
            </div>
            <button
              onClick={() => {
                setShowCreateModal(true);
                setCreateProjectModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-2xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-600"
            >
              <Plus className="h-4 w-4" />
              Creer mon premier projet
            </button>
          </section>
        ) : null}

        {!isLoading && projects.length > 0 ? (
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <article
                key={project.id}
                className="overflow-hidden rounded-[28px] border border-line bg-white transition hover:border-brand-200 hover:bg-slate-50 hover:shadow-panel"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-4">
                      {project.image_url ? (
                        <img src={project.image_url} alt={project.name} className="h-14 w-14 rounded-2xl object-cover" />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-base font-semibold text-brand-600">
                          {initials(project.name) || "P"}
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h2 className="truncate text-base font-semibold text-ink">{project.name}</h2>
                          <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusBadge(project.status)}`}>
                            {PROJECT_STATUSES.find((option) => option.value === project.status)?.label ?? project.status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted">
                          {project.created_at ? `Cree le ${new Date(project.created_at).toLocaleDateString("fr-FR")}` : "Projet"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingProject(project)}
                        className="flex h-9 w-9 items-center justify-center rounded-2xl border border-line text-muted transition hover:border-brand-200 hover:text-brand-600"
                        title="Modifier le projet"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingProject(project)}
                        className="flex h-9 w-9 items-center justify-center rounded-2xl border border-line text-muted transition hover:border-rose-200 hover:text-rose-600"
                        title="Supprimer le projet"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <p className="mt-4 min-h-[42px] text-sm leading-6 text-muted">
                    {project.description || "Aucune description pour le moment."}
                  </p>

                  <div className="mt-5 flex items-center justify-between">
                    <span className="text-sm font-medium text-muted">Ouvrir le projet</span>
                    <Link
                      to={`/projects/${project.id}`}
                      className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                    >
                      Ouvrir
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </article>
            ))}

            <button
              onClick={() => {
                setShowCreateModal(true);
                setCreateProjectModalOpen(true);
              }}
              className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-[28px] border-2 border-dashed border-line bg-white px-6 py-8 text-center transition hover:border-brand-300 hover:bg-brand-50/40"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-brand-600">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">Creer un projet</p>
                <p className="mt-1 text-sm text-muted">Nom obligatoire, statut, description et image.</p>
              </div>
            </button>
          </section>
        ) : null}
      </div>
    </>
  );
}
