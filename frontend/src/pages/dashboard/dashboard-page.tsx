import { ArrowRight, ImagePlus, Loader2, Plus, Rocket } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCreateProject, useProjects } from "../../hooks/use-projects";
import { useUiStore } from "../../stores/ui-store";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function NewProjectModal({ onClose }: { onClose: () => void }) {
  const { mutateAsync, isPending } = useCreateProject();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const isValid = useMemo(() => name.trim().length > 0, [name]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!isValid) return;

    await mutateAsync({
      name: name.trim(),
      description: description.trim() || null,
      image_url: imageUrl.trim() || null,
    });

    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[28px] border border-line bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-brand-600">Nouveau projet</p>
            <h2 className="mt-2 text-xl font-semibold text-ink dark:text-white">Creer un projet</h2>
            <p className="mt-2 text-sm text-muted dark:text-slate-400">
              Le projet est la structure la plus macro de Shadow PO AI.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-muted transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
          >
            Fermer
          </button>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-ink dark:text-white">Nom du projet *</label>
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex : HCL - Livret"
              className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-brand-950"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-ink dark:text-white">Description</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="Contexte, client, perimetre..."
              className="w-full resize-none rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-brand-950"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-ink dark:text-white">Image</label>
            <div className="flex items-center gap-3 rounded-2xl border border-line bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
              <ImagePlus className="h-4 w-4 text-muted dark:text-slate-400" />
              <input
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
                placeholder="URL d'image optionnelle"
                className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium text-ink transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!isValid || isPending}
              className="inline-flex items-center gap-2 rounded-2xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Creer le projet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { data: projects = [], isLoading } = useProjects();
  const createProjectModalOpen = useUiStore((state) => state.createProjectModalOpen);
  const setCreateProjectModalOpen = useUiStore((state) => state.setCreateProjectModalOpen);
  const [showModal, setShowModal] = useState(createProjectModalOpen);

  useEffect(() => {
    setShowModal(createProjectModalOpen);
  }, [createProjectModalOpen]);

  return (
    <>
      {showModal ? (
        <NewProjectModal
          onClose={() => {
            setShowModal(false);
            setCreateProjectModalOpen(false);
          }}
        />
      ) : null}

      <div className="mx-auto max-w-6xl space-y-8">
        <section className="rounded-[32px] border border-line bg-white p-8 shadow-panel dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-brand-600">Accueil</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink dark:text-white">Mes projets</h1>
              <p className="mt-3 text-sm leading-7 text-muted dark:text-slate-400">
                Le projet est la structure la plus macro dans Shadow PO AI. Depuis cette page, tu peux consulter
                tes projets existants et en creer un nouveau.
              </p>
            </div>
            <button
              onClick={() => {
                setShowModal(true);
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
          <div className="flex items-center justify-center rounded-[28px] border border-line bg-white py-20 text-muted shadow-panel dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Chargement des projets...
          </div>
        ) : null}

        {!isLoading && projects.length === 0 ? (
          <section className="flex flex-col items-center justify-center gap-4 rounded-[28px] border-2 border-dashed border-line bg-white py-20 text-center shadow-panel dark:border-slate-800 dark:bg-slate-950">
            <Rocket className="h-10 w-10 text-muted dark:text-slate-400" />
            <div>
              <p className="text-base font-semibold text-ink dark:text-white">Aucun projet pour l'instant</p>
              <p className="mt-2 text-sm text-muted dark:text-slate-400">
                Cree ton premier projet pour structurer ton workspace PO.
              </p>
            </div>
            <button
              onClick={() => {
                setShowModal(true);
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
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="group overflow-hidden rounded-[28px] border border-line bg-white transition hover:border-brand-200 hover:bg-slate-50 hover:shadow-panel dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700 dark:hover:bg-slate-900"
              >
                <div className="p-5">
                  <div className="flex items-center gap-4">
                    {project.image_url ? (
                      <img
                        src={project.image_url}
                        alt={project.name}
                        className="h-14 w-14 rounded-2xl object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-base font-semibold text-brand-600 dark:bg-slate-900 dark:text-brand-200">
                        {initials(project.name) || "P"}
                      </div>
                    )}

                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold text-ink dark:text-white">{project.name}</h2>
                      <p className="mt-1 text-xs text-muted dark:text-slate-400">
                        {project.created_at
                          ? `Cree le ${new Date(project.created_at).toLocaleDateString("fr-FR")}`
                          : "Projet"}
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 min-h-[42px] text-sm leading-6 text-muted dark:text-slate-400">
                    {project.description || "Aucune description pour le moment."}
                  </p>

                  <div className="mt-5 flex items-center justify-between">
                    <span className="text-sm font-medium text-muted dark:text-slate-400">Ouvrir le projet</span>
                    <ArrowRight className="h-4 w-4 text-muted transition group-hover:translate-x-1 group-hover:text-brand-600 dark:text-slate-400" />
                  </div>
                </div>
              </Link>
            ))}

            <button
              onClick={() => {
                setShowModal(true);
                setCreateProjectModalOpen(true);
              }}
              className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-[28px] border-2 border-dashed border-line bg-white px-6 py-8 text-center transition hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700 dark:hover:bg-slate-900"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-brand-600 dark:bg-slate-900 dark:text-brand-200">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink dark:text-white">Creer un projet</p>
                <p className="mt-1 text-sm text-muted dark:text-slate-400">
                  Nom obligatoire, description et image facultatives.
                </p>
              </div>
            </button>
          </section>
        ) : null}
      </div>
    </>
  );
}
