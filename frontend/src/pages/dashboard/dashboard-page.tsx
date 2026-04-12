import { ArrowRight, FolderOpen, ImagePlus, Loader2, Pencil, Plus, Rocket, Trash2, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCreateProject, useDeleteProject, useProjects, useUpdateProject } from "../../hooks/use-projects";
import { useNotificationsStore } from "../../stores/notifications-store";
import { useUiStore } from "../../stores/ui-store";
import type { Project } from "../../types/domain";

// ─── Helpers ──────────────────────────��────────────────────────────���──────────

const PROJECT_STATUSES = [
  { value: "active",    label: "Actif",          cls: "bg-emerald-50 text-emerald-700" },
  { value: "planning",  label: "En préparation",  cls: "bg-amber-50 text-amber-700" },
  { value: "archived",  label: "Archivé",         cls: "bg-slate-100 text-slate-500" },
];

function statusConfig(status: string) {
  return PROJECT_STATUSES.find((s) => s.value === status) ?? PROJECT_STATUSES[2];
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

const AVATAR_COLORS = [
  "from-brand-400 to-brand-600",
  "from-sky-400 to-sky-600",
  "from-cyan-400 to-cyan-600",
  "from-emerald-400 to-emerald-600",
  "from-amber-400 to-amber-500",
  "from-rose-400 to-rose-600",
];

function avatarColor(name: string) {
  const hash = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

// ─── Modal ─────────────────────────────���────────────────────────���─────────────

function ProjectModal({ project, onClose }: { project?: Project; onClose: () => void }) {
  const { mutateAsync: createProject, isPending: creating } = useCreateProject();
  const { mutateAsync: updateProject, isPending: updating } = useUpdateProject();
  const addToast = useNotificationsStore((s) => s.addToast);

  const [name, setName] = useState(project?.name ?? "");
  const [status, setStatus] = useState(project?.status ?? "active");
  const [description, setDescription] = useState(project?.description ?? "");
  const [imageUrl, setImageUrl] = useState(project?.image_url ?? "");
  const [errorMessage, setErrorMessage] = useState("");

  const isEdit = Boolean(project);
  const isPending = creating || updating;
  const isValid = useMemo(() => name.trim().length > 0, [name]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    setErrorMessage("");
    try {
      if (project) {
        await updateProject({ id: project.id, name: name.trim(), status, description: description.trim() || null, image_url: imageUrl.trim() || null });
        addToast({ type: "success", title: "Projet mis à jour", description: name.trim() });
      } else {
        await createProject({ name: name.trim(), status, description: description.trim() || null, image_url: imageUrl.trim() || null });
        addToast({ type: "success", title: "Projet créé", description: name.trim() });
      }
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Impossible d'enregistrer le projet.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg animate-modal rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
              {isEdit ? "Édition projet" : "Nouveau projet"}
            </p>
            <h2 className="mt-1.5 text-xl font-bold tracking-tight text-ink">
              {isEdit ? "Modifier le projet" : "Créer un projet"}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost">Fermer</button>
        </div>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <div>
            <label className="label">Nom du projet *</label>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : HCL — Livret patient" className="input" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Statut</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
                {PROJECT_STATUSES.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Image (URL)</label>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <ImagePlus className="h-4 w-4 flex-shrink-0 text-muted" />
                <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted" />
              </div>
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Contexte, client, périmètre…" className="input resize-none" />
          </div>

          {errorMessage && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" disabled={!isValid || isPending} className="btn-primary">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {isEdit ? "Enregistrer" : "Créer le projet"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteProjectModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const { mutateAsync: deleteProject, isPending } = useDeleteProject();
  const addToast = useNotificationsStore((s) => s.addToast);
  const [errorMessage, setErrorMessage] = useState("");

  async function confirmDelete() {
    setErrorMessage("");
    try {
      await deleteProject(project.id);
      addToast({ type: "success", title: "Projet supprimé", description: project.name });
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Impossible de supprimer le projet.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md animate-modal rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-widest text-red-600">Suppression</p>
        <h2 className="mt-1.5 text-xl font-bold tracking-tight text-ink">Supprimer le projet</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Le projet <strong className="text-ink">{project.name}</strong> et toutes ses données associées seront supprimés définitivement.
        </p>
        {errorMessage && (
          <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
          <button type="button" disabled={isPending} onClick={confirmDelete} className="btn-danger">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Project card ────────────────────────���────────────────────────────────────

function ProjectCard({
  project,
  onEdit,
  onDelete,
}: {
  project: Project;
  onEdit: (p: Project) => void;
  onDelete: (p: Project) => void;
}) {
  const sc = statusConfig(project.status);

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:border-brand-200 hover:shadow-md">
      {/* Header */}
      <div className="flex items-start gap-4 p-5">
        {project.image_url ? (
          <img src={project.image_url} alt={project.name} className="h-12 w-12 flex-shrink-0 rounded-xl object-cover" />
        ) : (
          <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold text-white ${avatarColor(project.name)}`}>
            {initials(project.name) || "P"}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="truncate text-[15px] font-semibold leading-snug text-ink">{project.name}</h2>
            <span className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${sc.cls}`}>
              {sc.label}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted">
            {project.created_at
              ? `Créé le ${new Date(project.created_at).toLocaleDateString("fr-FR")}`
              : "Projet"}
          </p>
        </div>
      </div>

      {/* Description */}
      <p className="min-h-[44px] px-5 text-sm leading-relaxed text-muted line-clamp-2">
        {project.description || "Aucune description renseignée."}
      </p>

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3.5">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(project)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-brand-50 hover:text-brand-600"
            title="Modifier"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(project)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-red-50 hover:text-red-500"
            title="Supprimer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        <Link
          to={`/projects/${project.id}`}
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
        >
          Ouvrir
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </article>
  );
}

// ─── Stats bar ─────────────────────────────��─────────────────────��────────────

function StatsBar({ projects }: { projects: Project[] }) {
  const active   = projects.filter((p) => p.status === "active").length;
  const planning = projects.filter((p) => p.status === "planning").length;
  const archived = projects.filter((p) => p.status === "archived").length;

  const stats = [
    { label: "Total",           value: projects.length, icon: FolderOpen, cls: "text-brand-600 bg-brand-50" },
    { label: "Actifs",          value: active,           icon: TrendingUp,  cls: "text-emerald-600 bg-emerald-50" },
    { label: "En préparation",  value: planning,         icon: Rocket,       cls: "text-amber-600 bg-amber-50" },
    { label: "Archivés",        value: archived,         icon: Loader2,     cls: "text-slate-500 bg-slate-100" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
          <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${s.cls}`}>
            <s.icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xl font-bold leading-none text-ink">{s.value}</p>
            <p className="mt-0.5 text-xs text-muted">{s.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page ────────────────────────��────────────────────────────────────────────

export function DashboardPage() {
  const { data: projects = [], isLoading } = useProjects();
  const createProjectModalOpen = useUiStore((s) => s.createProjectModalOpen);
  const setCreateProjectModalOpen = useUiStore((s) => s.setCreateProjectModalOpen);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(createProjectModalOpen);

  useEffect(() => {
    setShowCreateModal(createProjectModalOpen);
  }, [createProjectModalOpen]);

  function openCreate() {
    setShowCreateModal(true);
    setCreateProjectModalOpen(true);
  }

  function closeCreate() {
    setShowCreateModal(false);
    setCreateProjectModalOpen(false);
  }

  return (
    <>
      {showCreateModal && <ProjectModal onClose={closeCreate} />}
      {editingProject  && <ProjectModal project={editingProject} onClose={() => setEditingProject(null)} />}
      {deletingProject && <DeleteProjectModal project={deletingProject} onClose={() => setDeletingProject(null)} />}

      <div className="mx-auto max-w-6xl space-y-6">

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Tableau de bord</p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-ink">Mes projets</h1>
            <p className="mt-1 text-sm text-muted">Gérez vos projets produit et accédez à vos espaces de travail.</p>
          </div>
          <button onClick={openCreate} className="btn-primary flex-shrink-0">
            <Plus className="h-4 w-4" />
            Nouveau projet
          </button>
        </div>

        {/* Stats */}
        {!isLoading && projects.length > 0 && <StatsBar projects={projects} />}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-20 shadow-sm">
            <Loader2 className="mr-2.5 h-5 w-5 animate-spin text-brand-500" />
            <span className="text-sm text-muted">Chargement des projets…</span>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && projects.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-5 rounded-2xl border-2 border-dashed border-slate-200 bg-white py-24 text-center shadow-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50">
              <Rocket className="h-7 w-7 text-brand-500" />
            </div>
            <div>
              <p className="text-base font-semibold text-ink">Aucun projet pour l'instant</p>
              <p className="mt-1.5 text-sm text-muted">Créez votre premier projet pour structurer votre workspace PO.</p>
            </div>
            <button onClick={openCreate} className="btn-primary">
              <Plus className="h-4 w-4" />
              Créer mon premier projet
            </button>
          </div>
        )}

        {/* Grid */}
        {!isLoading && projects.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onEdit={setEditingProject}
                onDelete={setDeletingProject}
              />
            ))}

            {/* New project tile */}
            <button
              onClick={openCreate}
              className="flex min-h-[200px] flex-col items-center justify-center gap-3.5 rounded-2xl border-2 border-dashed border-slate-200 bg-white px-6 py-8 text-center transition hover:border-brand-300 hover:bg-brand-50/30"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-brand-200 bg-brand-50 text-brand-600">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">Créer un projet</p>
                <p className="mt-0.5 text-xs text-muted">Nom, statut, description, image</p>
              </div>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
