import { CalendarRange, Loader2, Pencil, Plus, Sparkles, Star, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useDeleteProject, useProject, useUpdateProject } from "../../hooks/use-projects";
import { useCreateSpace, useDeleteSpace, useSpaces, useUpdateSpace } from "../../hooks/use-spaces";
import { cn } from "../../lib/utils";
import type { Project, Space } from "../../types/domain";

const SPACE_STATUSES = [
  { value: "active", label: "Actif" },
  { value: "planning", label: "En preparation" },
  { value: "archived", label: "Archive" },
];

function statusBadge(status: string) {
  if (status === "active") return "bg-emerald-50 text-emerald-700";
  if (status === "planning") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

function formatDateRange(startDate: string | null, endDate: string | null) {
  if (!startDate && !endDate) return "Dates non renseignees";
  if (startDate && endDate) {
    return `${new Date(startDate).toLocaleDateString("fr-FR")} - ${new Date(endDate).toLocaleDateString("fr-FR")}`;
  }
  if (startDate) return `A partir du ${new Date(startDate).toLocaleDateString("fr-FR")}`;
  return `Jusqu'au ${new Date(endDate as string).toLocaleDateString("fr-FR")}`;
}

function ProjectSettingsModal({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  const { mutateAsync: updateProject, isPending } = useUpdateProject();
  const [name, setName] = useState(project.name);
  const [status, setStatus] = useState(project.status);
  const [description, setDescription] = useState(project.description ?? "");
  const [imageUrl, setImageUrl] = useState(project.image_url ?? "");
  const [errorMessage, setErrorMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage("");
    try {
      await updateProject({
        id: project.id,
        name: name.trim(),
        status,
        description: description.trim() || null,
        image_url: imageUrl.trim() || null,
      });
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Impossible d'enregistrer le projet.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[28px] border border-line bg-white p-6 shadow-2xl">
        <h2 className="text-xl font-semibold text-ink"></h2>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-ink">Nom</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
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
              {SPACE_STATUSES.map((option) => (
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
              className="w-full resize-none rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-ink">Image</label>
            <input
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
            />
          </div>
          {errorMessage ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div> : null}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium text-ink transition hover:bg-slate-50">
              Annuler
            </button>
            <button type="submit" disabled={isPending || !name.trim()} className="rounded-2xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60">
              {isPending ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SpaceModal({
  projectId,
  space,
  onClose,
}: {
  projectId: string;
  space?: Space;
  onClose: () => void;
}) {
  const { mutateAsync: createSpace, isPending: creating } = useCreateSpace();
  const { mutateAsync: updateSpace, isPending: updating } = useUpdateSpace();
  const [name, setName] = useState(space?.name ?? "");
  const [status, setStatus] = useState(space?.status ?? "active");
  const [description, setDescription] = useState(space?.description ?? "");
  const [startDate, setStartDate] = useState(space?.start_date ?? "");
  const [endDate, setEndDate] = useState(space?.end_date ?? "");
  const [isFavorite, setIsFavorite] = useState(space?.is_favorite ?? false);
  const [errorMessage, setErrorMessage] = useState("");
  const isEdit = Boolean(space);
  const isPending = creating || updating;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage("");
    try {
      if (space) {
        await updateSpace({
          id: space.id,
          name: name.trim(),
          status,
          description: description.trim() || null,
          start_date: startDate || null,
          end_date: endDate || null,
          is_favorite: isFavorite,
        });
      } else {
        await createSpace({
          project_id: projectId,
          name: name.trim(),
          status,
          description: description.trim() || null,
          start_date: startDate || null,
          end_date: endDate || null,
          is_favorite: isFavorite,
        });
      }
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Impossible d'enregistrer l'espace.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/25 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-[28px] border border-line bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-600">Projet</p>
            <h2 className="mt-2 text-xl font-semibold text-ink">{isEdit ? "Modifier l'espace" : "Creer un espace"}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-muted transition hover:bg-slate-50">
            Fermer
          </button>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-ink">Nom *</label>
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
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
              {SPACE_STATUSES.map((option) => (
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
              className="w-full resize-none rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-ink">Date de debut</label>
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-ink">Date de fin</label>
              <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100" />
            </div>
          </div>

          <label className="flex items-center gap-3 rounded-2xl border border-line bg-slate-50 px-4 py-3">
            <input type="checkbox" checked={isFavorite} onChange={(event) => setIsFavorite(event.target.checked)} className="h-4 w-4 rounded border-line text-brand-500 focus:ring-brand-500" />
            <div>
              <p className="text-sm font-medium text-ink">Epingler cet espace</p>
              <p className="text-xs text-muted">Les espaces favoris remontent en tete de liste.</p>
            </div>
          </label>

          {errorMessage ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div> : null}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium text-ink transition hover:bg-slate-50">
              Annuler
            </button>
            <button type="submit" disabled={isPending || !name.trim()} className="inline-flex items-center gap-2 rounded-2xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {isEdit ? "Enregistrer" : "Creer l'espace"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteProjectModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const navigate = useNavigate();
  const { mutateAsync: deleteProject, isPending } = useDeleteProject();
  const [errorMessage, setErrorMessage] = useState("");

  async function confirmDelete() {
    setErrorMessage("");
    try {
      await deleteProject(project.id);
      navigate("/");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Impossible de supprimer le projet.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] border border-line bg-white p-6 shadow-2xl">
        <h2 className="text-xl font-semibold text-ink">Supprimer le projet</h2>
        <p className="mt-3 text-sm leading-6 text-muted">Le projet <strong>{project.name}</strong> et ses donnees descendantes seront supprimes.</p>
        {errorMessage ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div> : null}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium text-ink transition hover:bg-slate-50">Annuler</button>
          <button type="button" disabled={isPending} onClick={confirmDelete} className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60">
            {isPending ? "Suppression..." : "Supprimer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteSpaceModal({ space, onClose }: { space: Space; onClose: () => void }) {
  const { mutateAsync: deleteSpace, isPending } = useDeleteSpace();
  const [errorMessage, setErrorMessage] = useState("");

  async function confirmDelete() {
    setErrorMessage("");
    try {
      await deleteSpace(space.id);
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Impossible de supprimer l'espace.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] border border-line bg-white p-6 shadow-2xl">
        <h2 className="text-xl font-semibold text-ink">Supprimer l'espace</h2>
        <p className="mt-3 text-sm leading-6 text-muted">L'espace <strong>{space.name}</strong> et ses donnees descendantes seront supprimes.</p>
        {errorMessage ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div> : null}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium text-ink transition hover:bg-slate-50">Annuler</button>
          <button type="button" disabled={isPending} onClick={confirmDelete} className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60">
            {isPending ? "Suppression..." : "Supprimer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SpaceCard({
  projectId,
  space,
  onEdit,
  onDelete,
}: {
  projectId: string;
  space: Space;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { mutate: updateSpace, isPending } = useUpdateSpace();

  return (
    <article className="rounded-[28px] border border-line bg-white p-5 shadow-panel transition hover:border-brand-200 hover:shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-lg font-semibold text-ink">{space.name}</h3>
            {space.is_favorite ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">Epingle</span> : null}
          </div>
          <p className="mt-1 text-sm text-muted">{formatDateRange(space.start_date, space.end_date)}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => updateSpace({ id: space.id, is_favorite: !space.is_favorite })}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-2xl border transition",
              space.is_favorite ? "border-emerald-200 bg-emerald-50 text-emerald-600" : "border-line bg-white text-muted hover:border-brand-200 hover:text-brand-600",
            )}
            title={space.is_favorite ? "Retirer des favoris" : "Epingler cet espace"}
          >
            <Star className={cn("h-4 w-4", space.is_favorite && "fill-current")} />
          </button>
          <button type="button" onClick={onEdit} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-line text-muted transition hover:border-brand-200 hover:text-brand-600">
            <Pencil className="h-4 w-4" />
          </button>
          <button type="button" onClick={onDelete} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-line text-muted transition hover:border-rose-200 hover:text-rose-600">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusBadge(space.status)}`}>
          {SPACE_STATUSES.find((option) => option.value === space.status)?.label ?? space.status}
        </span>
        <select
          value={space.status}
          onChange={(event) => updateSpace({ id: space.id, status: event.target.value })}
          className="rounded-xl border border-line bg-white px-3 py-2 text-xs text-ink outline-none transition focus:border-brand-500"
        >
          {SPACE_STATUSES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <p className="mt-4 min-h-[72px] text-sm leading-6 text-muted">{space.description || "Aucune description pour le moment."}</p>

      <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
        <div className="flex items-center gap-2 text-xs text-muted">
          <CalendarRange className="h-4 w-4" />
          <span>Contexte de travail</span>
        </div>
        <Link to={`/projects/${projectId}/spaces/${space.id}`} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800">
          Ouvrir
          <Sparkles className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [editingSpace, setEditingSpace] = useState<Space | null>(null);
  const [deletingSpace, setDeletingSpace] = useState<Space | null>(null);
  const [showCreateSpaceModal, setShowCreateSpaceModal] = useState(false);

  const { data: project, isLoading: loadingProject } = useProject(projectId);
  const { data: spaces = [], isLoading: loadingSpaces } = useSpaces(projectId);
  const favoriteSpaces = useMemo(() => spaces.filter((space) => space.is_favorite), [spaces]);

  if (loadingProject || loadingSpaces) {
    return (
      <div className="flex items-center justify-center py-20 text-muted">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Chargement du projet...
      </div>
    );
  }

  return (
    <>
      {showCreateSpaceModal && projectId ? <SpaceModal projectId={projectId} onClose={() => setShowCreateSpaceModal(false)} /> : null}
      {editingProject ? <ProjectSettingsModal project={editingProject} onClose={() => setEditingProject(null)} /> : null}
      {deletingProject ? <DeleteProjectModal project={deletingProject} onClose={() => setDeletingProject(null)} /> : null}
      {editingSpace && projectId ? <SpaceModal projectId={projectId} space={editingSpace} onClose={() => setEditingSpace(null)} /> : null}
      {deletingSpace ? <DeleteSpaceModal space={deletingSpace} onClose={() => setDeletingSpace(null)} /> : null}

      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Projet</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-ink">{project?.name ?? "Projet"}</h1>
              {project && (
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge(project.status)}`}>
                  {SPACE_STATUSES.find((o) => o.value === project.status)?.label ?? project.status}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted">
              {project?.description || "Centralisez vos espaces, sujets, documents et discussions IA."}
            </p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <button onClick={() => setEditingProject(project ?? null)} className="btn-secondary">
              <Pencil className="h-4 w-4" />
              Modifier
            </button>
            {project && (
              <button onClick={() => setDeletingProject(project)} className="btn-ghost text-red-500 hover:bg-red-50">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button onClick={() => setShowCreateSpaceModal(true)} className="btn-primary">
              <Plus className="h-4 w-4" />
              Nouvel espace
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Espaces", value: spaces.length, sub: "espaces de travail", cls: "text-brand-600 bg-brand-50" },
            { label: "Favoris", value: favoriteSpaces.length, sub: "espaces épinglés", cls: "text-emerald-600 bg-emerald-50" },
            { label: "Actifs", value: spaces.filter((s) => s.status === "active").length, sub: "en cours", cls: "text-amber-600 bg-amber-50" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted">{stat.label}</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-ink">{stat.value}</p>
              <p className="mt-0.5 text-xs text-muted">{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* Spaces section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-ink">Espaces de travail</h2>
              <p className="mt-0.5 text-sm text-muted">Chaque espace porte un nom, statut, description et dates.</p>
            </div>
          </div>

          {spaces.length === 0 ? (
            <button
              onClick={() => setShowCreateSpaceModal(true)}
              className="flex w-full flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-slate-200 bg-white py-20 text-center transition hover:border-brand-300 hover:bg-brand-50/20"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">Aucun espace pour le moment</p>
                <p className="mt-1 text-xs text-muted">Créez votre premier espace pour structurer ce projet.</p>
              </div>
            </button>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {spaces.map((space) => (
                <SpaceCard
                  key={space.id}
                  projectId={projectId!}
                  space={space}
                  onEdit={() => setEditingSpace(space)}
                  onDelete={() => setDeletingSpace(space)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
