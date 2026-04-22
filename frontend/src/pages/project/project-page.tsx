import {
  BookOpen,
  CalendarRange,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  FileText,
  FolderKanban,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useRef, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ProjectHero } from "../../components/project/project-hero";
import { ProjectSkillsSection } from "../../components/project/project-skills-section";
import { ProjectTabs } from "../../components/project/project-tabs";
import { PageSkeleton } from "../../components/ui/skeleton";
import { StatCard } from "../../components/ui/stat-card";
import {
  type KnowledgeDoc,
  useDeleteKnowledgeDoc,
  useKnowledgeDocs,
  useKnowledgeSyncStatus,
  useReplaceKnowledgeDocFile,
  useSyncProjectKnowledge,
  useUpdateKnowledgeDoc,
  useUploadKnowledgeDoc,
} from "../../hooks/use-knowledge";
import { useDeleteProject, useProjects, useUpdateProject } from "../../hooks/use-projects";
import { useCreateSpace, useDeleteSpace, useSpaces, useUpdateSpace } from "../../hooks/use-spaces";
import { cn } from "../../lib/utils";
import { isLegacyEntitySlug, projectPath, resolveEntityBySlug, spaceOverviewPath } from "../../lib/routes";
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
      <div className="w-full max-w-lg animate-modal rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-6 shadow-float">
        <h2 className="text-xl font-semibold text-ink">Modifier le projet</h2>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-ink">Nom</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-ink">Statut</label>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="input"
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
              className="input resize-none"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-ink">Image</label>
            <input
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              className="input"
            />
          </div>
          {errorMessage ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div> : null}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary">
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
      <div className="w-full max-w-xl animate-modal rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-6 shadow-float">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-600">Projet</p>
            <h2 className="mt-2 text-xl font-semibold text-ink">{isEdit ? "Modifier l'espace" : "Creer un espace"}</h2>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost border border-[var(--border)] px-3 py-2 text-xs">
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
              className="input"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-ink">Statut</label>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="input"
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
              className="input resize-none"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-ink">Date de debut</label>
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="input" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-ink">Date de fin</label>
              <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="input" />
            </div>
          </div>

          <label className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] px-4 py-3">
            <input type="checkbox" checked={isFavorite} onChange={(event) => setIsFavorite(event.target.checked)} className="h-4 w-4 rounded border-line text-brand-500 focus:ring-brand-500" />
            <div>
              <p className="text-sm font-medium text-ink">Epingler cet espace</p>
              <p className="text-xs text-muted">Les espaces favoris remontent en tete de liste.</p>
            </div>
          </label>

          {errorMessage ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div> : null}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">
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
      <div className="w-full max-w-md animate-modal rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-6 shadow-float">
        <h2 className="text-xl font-semibold text-ink">Supprimer le projet</h2>
        <p className="mt-3 text-sm leading-6 text-muted">Le projet <strong>{project.name}</strong> et ses donnees descendantes seront supprimes.</p>
        {errorMessage ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div> : null}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
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
      <div className="w-full max-w-md animate-modal rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-6 shadow-float">
        <h2 className="text-xl font-semibold text-ink">Supprimer l'espace</h2>
        <p className="mt-3 text-sm leading-6 text-muted">L'espace <strong>{space.name}</strong> et ses donnees descendantes seront supprimes.</p>
        {errorMessage ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div> : null}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
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
  projectName,
  space,
  onEdit,
  onDelete,
}: {
  projectId: string;
  projectName: string;
  space: Space;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { mutate: updateSpace, isPending } = useUpdateSpace();
  const statusLabel = SPACE_STATUSES.find((option) => option.value === space.status)?.label ?? space.status;

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md">
      {/* Subtle gradient glow in top right */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-60"
        style={{ background: "radial-gradient(circle at top right, rgba(99,102,241,0.09), transparent 55%)" }}
      />

      {/* Card body */}
      <div className="relative p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-lg font-bold tracking-tight text-[var(--text-strong)]">
                {space.name}
              </h3>
              {space.is_favorite && (
                <span className="badge badge-success">Épinglé</span>
              )}
            </div>
            <p className="mt-1.5 text-xs text-[var(--text-muted)]">
              {formatDateRange(space.start_date, space.end_date)}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={isPending}
              onClick={() => updateSpace({ id: space.id, is_favorite: !space.is_favorite })}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg border transition",
                space.is_favorite
                  ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                  : "border-[var(--border)] text-[var(--text-muted)] hover:border-brand-200 hover:text-brand-600",
              )}
              title={space.is_favorite ? "Retirer des favoris" : "Épingler cet espace"}
            >
              <Star className={cn("h-3.5 w-3.5", space.is_favorite && "fill-current")} />
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] transition hover:border-brand-200 hover:text-brand-600"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] transition hover:border-danger-200 hover:text-danger-500"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Status + quick-change */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className={cn("badge", statusBadge(space.status))}>{statusLabel}</span>
          <div className="relative">
            <select
              value={space.status}
              onChange={(event) => updateSpace({ id: space.id, status: event.target.value })}
              className="appearance-none rounded-lg border border-[var(--border)] bg-[var(--bg-panel-2)] py-1.5 pl-3 pr-8 text-xs font-medium text-[var(--text-strong)] outline-none transition focus:border-brand-400"
            >
              {SPACE_STATUSES.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
          </div>
        </div>

        {/* Description */}
        <div className="mt-4 min-h-[72px] rounded-xl bg-[var(--bg-panel-2)] px-4 py-3">
          <p className="section-title mb-2">Description</p>
          <p className="text-sm leading-relaxed text-[var(--text-muted)]">
            {space.description || "Aucune description pour le moment."}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-[var(--border)] px-5 py-3">
        <div className="flex items-center gap-2.5 text-xs text-[var(--text-muted)]">
          <CalendarRange className="h-3.5 w-3.5 flex-shrink-0" />
          <span>Documentation · Tickets · Chat</span>
        </div>
        <Link
          to={spaceOverviewPath({ id: projectId, name: projectName }, { id: space.id, name: space.name })}
          className="btn-primary text-xs"
        >
          Ouvrir
          <Sparkles className="h-3.5 w-3.5" />
        </Link>
      </div>
    </article>
  );
}

// ─── Knowledge: document type config ─────────────────────────────────────────

const DOC_TYPES: { value: string; label: string; cls: string }[] = [
  { value: "functional_spec", label: "Spécifications fonctionnelles", cls: "bg-brand-50 text-brand-700" },
  { value: "stable_memory", label: "Mémoire stable / décisions / vigilance", cls: "bg-amber-50 text-amber-700" },
  { value: "technical", label: "Technique", cls: "bg-brand-100 text-brand-800" },
  { value: "database", label: "Base de données", cls: "bg-brand-50 text-brand-700" },
  { value: "test_cases", label: "Cas de tests", cls: "bg-emerald-50 text-emerald-700" },
  { value: "reference", label: "Références complémentaires", cls: "bg-slate-100 text-slate-700" },
];

function docTypeLabel(value: string) {
  return DOC_TYPES.find((t) => t.value === value)?.label ?? value;
}

function docTypeCls(value: string) {
  return DOC_TYPES.find((t) => t.value === value)?.cls ?? "bg-slate-100 text-slate-700";
}

// ─── Knowledge: Upload modal ──────────────────────────────────────────────────

function UploadKnowledgeModal({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const { mutateAsync: uploadDoc, isPending } = useUploadKnowledgeDoc(projectId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("functional_spec");
  const [summary, setSummary] = useState("");
  const [tags, setTags] = useState("");
  const [error, setError] = useState("");

  function handleFile(f: File) {
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !title.trim()) return;
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", title.trim());
      fd.append("category", docType);
      fd.append("summary", summary.trim());
      fd.append("tags", tags);
      await uploadDoc(fd);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'upload");
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/30 p-4 backdrop-blur-sm">
      <div className="mx-auto flex min-h-full w-full max-w-lg items-center justify-center py-8">
      <div className="w-full animate-modal rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-6 shadow-float">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-600">Base de connaissance</p>
            <h2 className="mt-1.5 text-xl font-semibold text-ink">Ajouter un document</h2>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] transition hover:bg-[var(--bg-panel-2)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="mt-5 space-y-4">
          {/* File drop zone */}
          <div
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-6 transition",
              file ? "border-brand-300 bg-brand-50/30" : "border-[var(--border)] bg-[var(--bg-panel-2)] hover:border-brand-300 hover:bg-brand-50/20",
            )}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const dropped = e.dataTransfer.files[0];
              if (dropped) handleFile(dropped);
            }}
          >
            {file ? (
              <>
                <FileText className="h-8 w-8 text-brand-500" />
                <div className="text-center">
                  <p className="text-sm font-medium text-ink">{file.name}</p>
                  <p className="text-xs text-muted">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted" />
                <div className="text-center">
                  <p className="text-sm font-medium text-ink">Déposer un fichier</p>
                  <p className="text-xs text-muted">PDF, DOCX, TXT, MD — max 20 MB</p>
                </div>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.docx,.txt,.md,.markdown,.csv,.xlsx,text/markdown"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-ink">Titre *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input"
              placeholder="Ex: Spécification fonctionnelle v2.3"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-ink">Type</label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="input"
              >
                {[
                  { value: "functional_spec", label: "Spécifications fonctionnelles" },
                  { value: "stable_memory", label: "Mémoire stable / décisions / vigilance" },
                  { value: "technical", label: "Technique" },
                  { value: "database", label: "Base de données" },
                  { value: "test_cases", label: "Cas de tests" },
                  { value: "reference", label: "Références complémentaires" },
                ].map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-ink">Tags <span className="text-muted">(virgules)</span></label>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="input"
                placeholder="gef, livret, sso"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-ink">Résumé <span className="text-muted">(aide la sélection IA)</span></label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={2}
              className="input resize-none"
              placeholder="Décrivez brièvement le contenu et l'usage de ce document."
            />
          </div>

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">
              Annuler
            </button>
            <button
              type="submit"
              disabled={isPending || !file || !title.trim()}
              className="btn-primary disabled:opacity-60"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {isPending ? "Upload en cours…" : "Uploader"}
            </button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
}

// ─── Knowledge: edit metadata modal ──────────────────────────────────────────

function EditKnowledgeModal({
  doc,
  projectId,
  onClose,
}: {
  doc: KnowledgeDoc;
  projectId: string;
  onClose: () => void;
}) {
  const { mutateAsync: updateDoc, isPending } = useUpdateKnowledgeDoc(projectId);
  const [title, setTitle] = useState(doc.title);
  const [docType, setDocType] = useState(doc.category);
  const [summary, setSummary] = useState(doc.summary ?? "");
  const [tags, setTags] = useState(doc.tags.join(", "));
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await updateDoc({
        id: doc.id,
        title: title.trim(),
        category: docType,
        summary: summary.trim() || null,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/30 p-4 backdrop-blur-sm">
      <div className="mx-auto flex min-h-full w-full max-w-md items-center justify-center py-8">
      <div className="w-full animate-modal rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-6 shadow-float">
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-semibold text-ink">Modifier le document</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] transition hover:bg-[var(--bg-panel-2)]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-ink">Titre</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-ink">Type</label>
              <select value={docType} onChange={(e) => setDocType(e.target.value)} className="input">
                {[
                  { value: "functional_spec", label: "Spécifications fonctionnelles" },
                  { value: "stable_memory", label: "Mémoire stable / décisions / vigilance" },
                  { value: "technical", label: "Technique" },
                  { value: "database", label: "Base de données" },
                  { value: "test_cases", label: "Cas de tests" },
                  { value: "reference", label: "Références complémentaires" },
                ].map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-ink">Tags</label>
              <input value={tags} onChange={(e) => setTags(e.target.value)} className="input" />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-ink">Résumé</label>
            <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} className="input resize-none" />
          </div>
          {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" disabled={isPending || !title.trim()} className="rounded-2xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60">{isPending ? "Enregistrement…" : "Enregistrer"}</button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
}

// ─── Knowledge: document card ─────────────────────────────────────────────────

function KnowledgeDocCard({
  doc,
  projectId,
  onEdit,
  showDebug,
}: {
  doc: KnowledgeDoc;
  projectId: string;
  onEdit: () => void;
  showDebug: boolean;
}) {
  const { mutate: updateDoc } = useUpdateKnowledgeDoc(projectId);
  const { mutate: deleteDoc, isPending: deleting } = useDeleteKnowledgeDoc(projectId);
  const { mutate: replaceFile, isPending: replacing } = useReplaceKnowledgeDocFile(projectId);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  function handleReplaceFile(e: { target: { files?: FileList | null; value: string } }) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    replaceFile({ id: doc.id, formData: fd });
    e.target.value = "";
  }

  return (
    <article className={cn(
      "rounded-xl border bg-[var(--bg-panel)] p-4 shadow-sm transition",
      doc.is_active ? "border-[var(--border)]" : "border-dashed border-[var(--border)] opacity-60",
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", docTypeCls(doc.category))}>
              {docTypeLabel(doc.category)}
            </span>
            {doc.sync_status === "not_synced" && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                Pas encore synchronisé
              </span>
            )}
            {!doc.is_active && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                Inactif
              </span>
            )}
            {["synced", "added", "updated", "ignored"].includes(doc.sync_status) && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                {doc.sync_status === "ignored" ? "Inchangé" : "Synchronisé"}
              </span>
            )}
            {doc.sync_status === "pending_removal" && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                Retrait en attente
              </span>
            )}
            {doc.sync_status === "removed" && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                Retiré du corpus
              </span>
            )}
            {doc.sync_status === "error" && (
              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600" title={doc.sync_error ?? undefined}>
                Erreur sync
              </span>
            )}
          </div>
          <p className="mt-2 text-sm font-semibold text-ink">{doc.title}</p>
          {doc.summary && (
            <p className="mt-1 text-xs leading-relaxed text-muted line-clamp-2">{doc.summary}</p>
          )}
          {doc.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {doc.tags.map((tag) => (
                <span key={tag} className="badge badge-neutral">
                  #{tag}
                </span>
              ))}
            </div>
          )}
          {showDebug && (
            <div className="mt-2 space-y-1 font-mono text-[10px] text-muted">
              {doc.content_hash ? <p>hash: {doc.content_hash.slice(0, 16)}</p> : null}
              {doc.local_file_id ? <p>local_file_id: {doc.local_file_id}</p> : null}
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted">
            <span>Source: {doc.source_type}</span>
            <span>Maj: {doc.updated_at ? new Date(doc.updated_at).toLocaleString("fr-FR") : "n/a"}</span>
          </div>
          {doc.sync_status === "error" && (
            <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
              <span>{doc.sync_error ?? "Aucun contenu textuel disponible."}</span>
              <button
                onClick={() => replaceInputRef.current?.click()}
                disabled={replacing}
                className="ml-2 underline font-semibold hover:text-rose-900"
              >
                {replacing ? "Chargement…" : "Remplacer le fichier"}
              </button>
              <input
                ref={replaceInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.docx,.xlsx,.txt,.md,.csv,.json"
                onChange={handleReplaceFile}
              />
            </div>
          )}
        </div>

        <div className="flex flex-shrink-0 flex-col items-end gap-2">
          {/* Active toggle */}
          <button
            onClick={() => updateDoc({ id: doc.id, is_active: !doc.is_active })}
            className={cn(
              "flex h-7 w-12 items-center rounded-full transition",
              doc.is_active ? "bg-brand-500" : "bg-slate-200",
            )}
            title={doc.is_active ? "Désactiver" : "Activer"}
          >
            <span className={cn(
              "ml-0.5 h-6 w-6 rounded-full bg-[var(--bg-panel)] shadow-sm transition-transform",
              doc.is_active ? "translate-x-5" : "translate-x-0",
            )} />
          </button>
          <div className="flex gap-1.5">
            <button
              onClick={onEdit}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-muted transition hover:border-brand-200 hover:text-brand-600"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              onClick={() => deleteDoc(doc.id)}
              disabled={deleting}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-muted transition hover:border-rose-200 hover:text-rose-600"
              title="Retirer du corpus local"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

// ─── Knowledge: section ───────────────────────────────────────────────────────

function KnowledgeSection({ projectId }: { projectId: string }) {
  const { data: docs = [], isLoading } = useKnowledgeDocs(projectId);
  const { data: syncStatus } = useKnowledgeSyncStatus(projectId);
  const { mutateAsync: syncCorpus, isPending: syncing } = useSyncProjectKnowledge(projectId);
  const [showUpload, setShowUpload] = useState(false);
  const [editingDoc, setEditingDoc] = useState<KnowledgeDoc | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showDebug, setShowDebug] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const filtered = typeFilter === "all" ? docs : docs.filter((d) => d.category === typeFilter);
  const activeCount = docs.filter((d) => d.is_active).length;
  const syncedCount = docs.filter((d) => ["synced", "ignored"].includes(d.sync_status)).length;
  const summary = syncStatus?.last_sync_summary_json ?? {};

  async function handleSync() {
    setSyncResult(null);
    try {
      const result = await syncCorpus();
      const nextSummary = result.summary ?? {};
      setSyncResult(
        `${nextSummary.added ?? 0} ajouté${(nextSummary.added ?? 0) > 1 ? "s" : ""}, ` +
        `${nextSummary.updated ?? 0} mis à jour, ` +
        `${nextSummary.ignored ?? 0} ignoré${(nextSummary.ignored ?? 0) > 1 ? "s" : ""}, ` +
        `${nextSummary.removed ?? 0} retiré${(nextSummary.removed ?? 0) > 1 ? "s" : ""}` +
        (result.errors.length > 0 ? ` — ${result.errors.length} erreur(s)` : ""),
      );
    } catch (error) {
      setSyncResult(error instanceof Error ? error.message : "Erreur lors de la synchronisation.");
    }
  }

  return (
    <>
      {showUpload && <UploadKnowledgeModal projectId={projectId} onClose={() => setShowUpload(false)} />}
      {editingDoc && (
        <EditKnowledgeModal doc={editingDoc} projectId={projectId} onClose={() => setEditingDoc(null)} />
      )}

      <section className="space-y-4">
        {/* Section header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink">Connaissances projet</h2>
            <p className="mt-0.5 text-sm text-muted">
              Corpus métier du projet — indexé localement, utilisé par l'IA à la demande.
              {activeCount > 0 && (
                <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  <Check className="h-2.5 w-2.5" />
                  {activeCount} actif{activeCount > 1 ? "s" : ""}
                </span>
              )}
              {syncedCount > 0 && (
                <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
                  <Sparkles className="h-2.5 w-2.5" />
                  {syncedCount} dans le corpus
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSync}
              disabled={syncing}
              className={cn(
                "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs transition",
                syncing
                  ? "border-brand-200 bg-brand-50 text-brand-700"
                  : "border-line text-muted hover:border-brand-200 hover:text-brand-700",
              )}
              title="Synchroniser les documents actifs dans le corpus MePO"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
              {syncing ? "Synchronisation..." : "Synchroniser"}
            </button>
            <button
              onClick={() => setShowDebug((prev) => !prev)}
              className={cn(
                "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs transition",
                showDebug
                  ? "border-brand-200 bg-brand-50 text-brand-600"
                  : "border-line text-muted hover:text-ink",
              )}
            >
              {showDebug ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              Debug
            </button>
            <button onClick={() => setShowUpload(true)} className="btn-primary">
              <Plus className="h-4 w-4" />
              Ajouter
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Dernière synchronisation</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] px-4 py-3"><p className="text-[11px] font-semibold text-muted">Statut</p><p className="mt-1 text-sm text-ink">{syncStatus?.last_sync_status ?? "idle"}</p></div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] px-4 py-3"><p className="text-[11px] font-semibold text-muted">Dernière fin</p><p className="mt-1 text-sm text-ink">{syncStatus?.last_sync_finished_at ? new Date(syncStatus.last_sync_finished_at).toLocaleString("fr-FR") : "Jamais"}</p></div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] px-4 py-3"><p className="text-[11px] font-semibold text-muted">Traités</p><p className="mt-1 text-sm text-ink">{summary.scanned ?? 0}</p></div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] px-4 py-3"><p className="text-[11px] font-semibold text-muted">Ajoutés</p><p className="mt-1 text-sm text-ink">{summary.added ?? 0}</p></div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] px-4 py-3"><p className="text-[11px] font-semibold text-muted">Mis à jour</p><p className="mt-1 text-sm text-ink">{summary.updated ?? 0}</p></div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] px-4 py-3"><p className="text-[11px] font-semibold text-muted">Ignorés</p><p className="mt-1 text-sm text-ink">{summary.ignored ?? 0}</p></div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] px-4 py-3"><p className="text-[11px] font-semibold text-muted">Retirés</p><p className="mt-1 text-sm text-ink">{summary.removed ?? 0}</p></div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] px-4 py-3"><p className="text-[11px] font-semibold text-muted">Erreurs</p><p className="mt-1 text-sm text-ink">{summary.errors ?? 0}</p></div>
          </div>
          {syncStatus?.last_sync_error ? (
            <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
              {syncStatus.last_sync_error}
            </div>
          ) : null}
        </div>

        {/* Sync result banner */}
        {syncResult && (
          <div className="flex items-center justify-between rounded-2xl border border-brand-100 bg-brand-50/60 px-4 py-2.5 text-xs text-brand-700">
            <span><Sparkles className="mr-1.5 inline h-3.5 w-3.5" />{syncResult}</span>
            <button onClick={() => setSyncResult(null)} className="ml-3 text-brand-400 hover:text-brand-700">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Type filter */}
        <div className="flex flex-wrap gap-2">
          {[{ value: "all", label: "Tous" }, ...[
            { value: "functional_spec", label: "Spécifications fonctionnelles" },
            { value: "stable_memory", label: "Mémoire stable" },
            { value: "technical", label: "Technique" },
            { value: "database", label: "Base de données" },
            { value: "test_cases", label: "Cas de tests" },
            { value: "reference", label: "Références" },
          ]].map((t) => {
            const count = t.value === "all" ? docs.length : docs.filter((d) => d.category === t.value).length;
            return (
              <button
                key={t.value}
                onClick={() => setTypeFilter(t.value)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition",
                  typeFilter === t.value
                    ? "bg-brand-500 text-white"
                    : "border border-[var(--border)] bg-[var(--bg-panel)] text-[var(--text-muted)] hover:border-brand-200 hover:text-brand-600",
                )}
              >
                {t.label}
                {count > 0 && <span className="ml-1.5 opacity-70">{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Document list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Chargement…
          </div>
        ) : filtered.length === 0 ? (
          <button
            onClick={() => setShowUpload(true)}
            className="empty-state transition hover:border-brand-300"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Aucun document de connaissance</p>
              <p className="mt-1 text-xs text-muted">Ajoute des spécifications, notes stables, docs techniques, cas de tests ou références.</p>
            </div>
          </button>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((doc) => (
              <KnowledgeDocCard
                key={doc.id}
                doc={doc}
                projectId={projectId}
                onEdit={() => setEditingDoc(doc)}
                showDebug={showDebug}
              />
            ))}
          </div>
        )}

        {/* Info banner */}
        <div className="flex items-start gap-3 rounded-2xl border border-brand-100 bg-brand-50/40 px-4 py-3">
          <FolderKanban className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-500" />
          <p className="text-xs leading-relaxed text-brand-700/80">
            <strong>Comment ça marche ?</strong> Les documents restent dans MePO. Quand tu cliques sur
            <strong> Synchroniser</strong>, MePO calcule une empreinte de chaque document actif et met à jour
            le corpus local utilisé par l'IA. Aucun service externe n'est sollicité.
          </p>
        </div>
      </section>
    </>
  );
}

// ─── Page tabs ────────────────────────────────────────────────────────────────

type ProjectTab = "spaces" | "ai_context";
type KnowledgeTab = "skills" | "documents";

function ProjectWorkspaceRail({
  spaces,
  knowledgeDocs,
  activeKnowledgeTab,
}: {
  spaces: Space[];
  knowledgeDocs: KnowledgeDoc[];
  activeKnowledgeTab: KnowledgeTab;
}) {
  const syncedDocs = knowledgeDocs.filter((doc) => doc.sync_status === "synced").length;
  const categoryCounts = [
    { key: "functional_spec", label: "Specs", count: knowledgeDocs.filter((doc) => doc.category === "functional_spec").length },
    { key: "stable_memory", label: "Mémoire", count: knowledgeDocs.filter((doc) => doc.category === "stable_memory").length },
    { key: "technical", label: "Technique", count: knowledgeDocs.filter((doc) => doc.category === "technical").length },
    { key: "test_cases", label: "Tests", count: knowledgeDocs.filter((doc) => doc.category === "test_cases").length },
  ].filter((item) => item.count > 0);

  return (
    <div className="space-y-4">
      
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ProjectPage() {
  const navigate = useNavigate();
  const { projectSlug } = useParams<{ projectSlug: string }>();
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [editingSpace, setEditingSpace] = useState<Space | null>(null);
  const [deletingSpace, setDeletingSpace] = useState<Space | null>(null);
  const [showCreateSpaceModal, setShowCreateSpaceModal] = useState(false);
  const [activeTab, setActiveTab] = useState<ProjectTab>("spaces");
  const [activeKnowledgeTab, setActiveKnowledgeTab] = useState<KnowledgeTab>("skills");

  const { data: projects = [], isLoading: loadingProjects } = useProjects();
  const project = useMemo(() => resolveEntityBySlug(projects, projectSlug), [projects, projectSlug]);
  const projectId = project?.id;

  const { data: spaces = [], isLoading: loadingSpaces } = useSpaces(projectId);
  const favoriteSpaces = useMemo(() => spaces.filter((space) => space.is_favorite), [spaces]);
  const knowledgeDocs: KnowledgeDoc[] = [];
  const syncedCount: number = 0;

  useEffect(() => {
    if (!project || !isLegacyEntitySlug(projectSlug)) return;
    navigate(projectPath(project), { replace: true });
  }, [navigate, project, projectSlug]);

  if (loadingProjects || loadingSpaces) {
    return <PageSkeleton />;
  }

  return (
    <>
      {showCreateSpaceModal && projectId ? <SpaceModal projectId={projectId} onClose={() => setShowCreateSpaceModal(false)} /> : null}
      {editingProject ? <ProjectSettingsModal project={editingProject} onClose={() => setEditingProject(null)} /> : null}
      {deletingProject ? <DeleteProjectModal project={deletingProject} onClose={() => setDeletingProject(null)} /> : null}
      {editingSpace && projectId ? <SpaceModal projectId={projectId} space={editingSpace} onClose={() => setEditingSpace(null)} /> : null}
      {deletingSpace ? <DeleteSpaceModal space={deletingSpace} onClose={() => setDeletingSpace(null)} /> : null}

      <div className="space-y-6">
        {/* ── Page header ─────────────────────────────────────────── */}
        <ProjectHero
          title={project?.name ?? "Projet"}
          spacesCount={spaces.length}
          favoriteSpacesCount={favoriteSpaces.length}
          aiContextCount={1}
          description={project?.description ?? "Consultez les espaces, la base de connaissance et les réglages du projet."}
          actions={
            <>
              <button onClick={() => setShowCreateSpaceModal(true)} className="btn-primary">
                <Plus className="h-4 w-4" />
                Nouvel espace
              </button>
              <button onClick={() => setEditingProject(project ?? null)} className="btn-secondary">
                <Pencil className="h-4 w-4" />
                Modifier
              </button>
              {project && (
                <button onClick={() => setDeletingProject(project)} className="btn-ghost text-[var(--danger)] hover:bg-rose-50">
                  <Trash2 className="h-4 w-4" />
                  Supprimer
                </button>
              )}
            </>
          }
        />

        {/* ── KPI strip ───────────────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Espaces" value={spaces.length} hint="couches de travail" tone="brand" icon={<FolderKanban className="h-4 w-4" />} />
          <StatCard label="Favoris" value={favoriteSpaces.length} hint="espaces épinglés" tone="warning" icon={<Star className="h-4 w-4" />} />
          <StatCard label="Knowledge" value={knowledgeDocs.length} hint={`${syncedCount} synchronisé${syncedCount !== 1 ? "s" : ""}`} tone="violet" icon={<BookOpen className="h-4 w-4" />} />
        </div>

        {/* ── Tab bar ─────────────────────────────────────────────── */}
        <ProjectTabs activeTab={activeTab} onChange={setActiveTab} />

        {/* ── Tab content ─────────────────────────────────────────── */}
        {activeTab === "spaces" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-[var(--text-strong)]">Espaces de travail</h2>
                <p className="mt-0.5 text-sm text-[var(--text-muted)]">Accédez à chaque espace, modifiez-les ou ouvrez-les.</p>
              </div>
              <button onClick={() => setShowCreateSpaceModal(true)} className="btn-primary">
                <Plus className="h-4 w-4" />
                Nouvel espace
              </button>
            </div>
            {spaces.length === 0 ? (
              <button
                onClick={() => setShowCreateSpaceModal(true)}
                className="empty-state transition hover:border-brand-300 hover:bg-brand-50/20"
              >
                <div className="empty-state-icon"><Plus className="h-5 w-5" /></div>
                <div>
                  <p className="empty-state-title">Aucun espace pour le moment</p>
                  <p className="empty-state-description">Crée ton premier espace pour structurer le projet par semestre, release ou discovery.</p>
                </div>
              </button>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                {spaces.map((space) => (
          <SpaceCard key={space.id} projectId={projectId!} projectName={project?.name ?? projectSlug ?? "projet"} space={space} onEdit={() => setEditingSpace(space)} onDelete={() => setDeletingSpace(space)} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Sous-onglets Skills / Documents */}
            <div className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] p-1 w-fit">
              {([
                { key: "skills", label: "Skill IA" },
                { key: "documents", label: "Base de connaissances" },
              ] as { key: KnowledgeTab; label: string }[]).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveKnowledgeTab(tab.key)}
                  className={cn(
                    "rounded-lg px-4 py-1.5 text-sm font-medium transition",
                    activeKnowledgeTab === tab.key
                      ? "bg-[var(--bg-panel)] text-[var(--text-strong)] shadow-sm"
                      : "text-[var(--text-muted)] hover:text-[var(--text-strong)]",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeKnowledgeTab === "skills" ? (
              projectId ? <ProjectSkillsSection projectId={projectId} /> : null
            ) : (
              projectId ? <KnowledgeSection projectId={projectId} /> : null
            )}
          </div>
        )}
      </div>
    </>
  );
}
