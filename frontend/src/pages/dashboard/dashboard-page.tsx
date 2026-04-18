import { FolderOpen, ImagePlus, Loader2, Plus, Rocket, Sparkles, Trash2, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useCreateProject, useDeleteProject, useProjects, useUpdateProject } from "../../hooks/use-projects";
import { useNotificationsStore } from "../../stores/notifications-store";
import { useUiStore } from "../../stores/ui-store";
import { ProjectDashboardCard } from "../../components/dashboard/project-dashboard-card";
import { DashboardHero } from "../../components/dashboard/dashboard-hero";
import { KpiSection } from "../../components/dashboard/kpi-section";
import { Button } from "../../components/ui/button";
import { ModalScaffold } from "../../components/ui/modal-scaffold";
import { SectionHeader } from "../../components/ui/section-header";
import { ProjectCardSkeleton } from "../../components/ui/skeleton";
import { StatCard } from "../../components/ui/stat-card";
import type { Project } from "../../types/domain";

const PROJECT_STATUS_OPTIONS = [
  { value: "active", label: "Actif" },
  { value: "planning", label: "En préparation" },
  { value: "archived", label: "Archivé" },
] as const;

function ProjectModal({ project, onClose }: { project?: Project; onClose: () => void }) {
  const { mutateAsync: createProject, isPending: creating } = useCreateProject();
  const { mutateAsync: updateProject, isPending: updating } = useUpdateProject();
  const addToast = useNotificationsStore((state) => state.addToast);

  const [name, setName] = useState(project?.name ?? "");
  const [status, setStatus] = useState(project?.status ?? "active");
  const [description, setDescription] = useState(project?.description ?? "");
  const [imageUrl, setImageUrl] = useState(project?.image_url ?? "");
  const [error, setError] = useState("");

  const isEdit = Boolean(project);
  const isPending = creating || updating;
  const isValid = name.trim().length > 0;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValid) return;
    setError("");

    try {
      if (project) {
        await updateProject({
          id: project.id,
          name: name.trim(),
          status,
          description: description.trim() || null,
          image_url: imageUrl.trim() || null,
        });
        addToast({ type: "success", title: "Projet mis à jour", description: name.trim() });
      } else {
        await createProject({
          name: name.trim(),
          status,
          description: description.trim() || null,
          image_url: imageUrl.trim() || null,
        });
        addToast({ type: "success", title: "Projet créé", description: name.trim() });
      }
      onClose();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Impossible d'enregistrer ce projet.");
    }
  }

  return (
    <ModalScaffold
      size="lg"
      eyebrow={isEdit ? "Édition" : "Nouveau projet"}
      title={isEdit ? project?.name ?? "Projet" : "Créer un projet"}
      description="Le projet centralise ses espaces, sa base de connaissance et ses arbitrages. Renseignez seulement le contexte utile."
      onClose={onClose}
      footer={(
        <>
          <Button type="button" variant="secondary" size="md" onClick={onClose}>Annuler</Button>
          <Button type="submit" form="project-modal-form" variant="primary" size="md" disabled={!isValid || isPending} leadingIcon={isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}>
            {isEdit ? "Enregistrer" : "Créer le projet"}
          </Button>
        </>
      )}
    >
      <form id="project-modal-form" onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Nom du projet *</label>
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex : HCL — Livret patient"
              className="input"
            />
          </div>

          <div>
            <label className="label">Statut</label>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="input">
              {PROJECT_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Image (URL)</label>
            <div className="flex items-center gap-2 rounded-[16px] border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-2.5">
              <ImagePlus className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
              <input
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
                placeholder="https://…"
                className="w-full bg-transparent text-sm text-[var(--text-strong)] outline-none placeholder:text-[var(--text-muted)]"
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="label">Description</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              placeholder="Contexte métier, périmètre, enjeux, signaux importants…"
              className="input resize-none"
            />
          </div>
        </div>

        {error ? (
          <div className="rounded-[16px] border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-[var(--danger)]">
            {error}
          </div>
        ) : null}
      </form>
    </ModalScaffold>
  );
}

function DeleteProjectModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const { mutateAsync: deleteProject, isPending } = useDeleteProject();
  const addToast = useNotificationsStore((state) => state.addToast);
  const [error, setError] = useState("");

  async function confirm() {
    setError("");
    try {
      await deleteProject(project.id);
      addToast({ type: "success", title: "Projet supprimé", description: project.name });
      onClose();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Impossible de supprimer ce projet.");
    }
  }

  return (
    <ModalScaffold
      size="sm"
      eyebrow="Suppression"
      title="Supprimer le projet"
      description={`Le projet "${project.name}" et ses vues associées seront supprimés définitivement.`}
      onClose={onClose}
      footer={(
        <>
          <Button type="button" variant="secondary" size="md" onClick={onClose}>Annuler</Button>
          <Button type="button" variant="danger" size="md" onClick={() => void confirm()} disabled={isPending} leadingIcon={isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}>
            Supprimer
          </Button>
        </>
      )}
    >
      <div className="space-y-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-rose-50 text-[var(--danger)]">
          <Trash2 className="h-5 w-5" />
        </div>
        <p className="text-sm leading-6 text-[var(--text-muted)]">
          Cette action retire le cockpit du projet, ses espaces et les contenus associés. Assurez-vous qu’aucune équipe ne travaille encore dessus.
        </p>
        {error ? (
          <div className="rounded-[16px] border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-[var(--danger)]">
            {error}
          </div>
        ) : null}
      </div>
    </ModalScaffold>
  );
}

export function DashboardPage() {
  const { data: projects = [], isLoading } = useProjects();
  const createProjectModalOpen = useUiStore((state) => state.createProjectModalOpen);
  const setCreateProjectModalOpen = useUiStore((state) => state.setCreateProjectModalOpen);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [showCreate, setShowCreate] = useState(createProjectModalOpen);

  useEffect(() => {
    setShowCreate(createProjectModalOpen);
  }, [createProjectModalOpen]);

  function openCreate() {
    setShowCreate(true);
    setCreateProjectModalOpen(true);
  }

  function closeCreate() {
    setShowCreate(false);
    setCreateProjectModalOpen(false);
  }

  const activeCount = useMemo(() => projects.filter((project) => project.status === "active").length, [projects]);
  const planningCount = useMemo(() => projects.filter((project) => project.status === "planning").length, [projects]);
  const archivedCount = useMemo(() => projects.filter((project) => project.status === "archived").length, [projects]);

  return (
    <>
      {showCreate ? <ProjectModal onClose={closeCreate} /> : null}
      {editingProject ? <ProjectModal project={editingProject} onClose={() => setEditingProject(null)} /> : null}
      {deletingProject ? <DeleteProjectModal project={deletingProject} onClose={() => setDeletingProject(null)} /> : null}

      <div className="mx-auto max-w-[1280px] space-y-8 animate-fade-in">
        <DashboardHero projectCount={projects.length} activeCount={activeCount} onCreate={openCreate} />

        <KpiSection>
          <StatCard
            label="Total"
            value={projects.length}
            hint="Portefeuille visible"
            tone="brand"
            icon={<FolderOpen className="h-4 w-4" />}
          />
          <StatCard
            label="Actifs"
            value={activeCount}
            hint="En delivery ou cadrage actif"
            tone="success"
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <StatCard
            label="Préparation"
            value={planningCount}
            hint="Sujets à cadrer"
            tone="warning"
            icon={<Sparkles className="h-4 w-4" />}
          />
          <StatCard
            label="Archivés"
            value={archivedCount}
            hint="Historique consolidé"
            tone="neutral"
            icon={<Rocket className="h-4 w-4" />}
          />
        </KpiSection>

        <section className="space-y-4">
          <SectionHeader
            eyebrow="Portefeuille"
            title="Projets suivis"
            description="Des cartes plus éditoriales pour lire vite le contexte, le statut et ouvrir le bon espace de travail."
          />

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((index) => <ProjectCardSkeleton key={index} />)}
            </div>
          ) : projects.length === 0 ? (
            <button
              onClick={openCreate}
              className="empty-state transition hover:border-brand-300"
            >
              <div className="empty-state-icon"><Rocket className="h-6 w-6" /></div>
              <div>
                <p className="empty-state-title">Aucun projet pour l’instant</p>
                <p className="empty-state-description">
                  Créez votre premier projet pour structurer les espaces, les tickets et la base de connaissance.
                </p>
              </div>
              <span className="btn-primary pointer-events-none">
                <Plus className="h-4 w-4" />
                Créer mon premier projet
              </span>
            </button>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {projects.map((project) => (
                <ProjectDashboardCard
                  key={project.id}
                  project={project}
                  onEdit={setEditingProject}
                  onDelete={setDeletingProject}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
