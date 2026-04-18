import { FolderOpen, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { memo, useState } from "react";
import { Link } from "react-router-dom";
import { avatarGradient, formatDate, initials } from "../../lib/format";
import { projectPath } from "../../lib/routes";
import { cn } from "../../lib/utils";
import type { Project } from "../../types/domain";
import { Button } from "../ui/button";

const PROJECT_STATUS_STYLES: Record<string, string> = {
  active: "badge badge-brand",
  planning: "badge badge-warning",
  archived: "badge badge-neutral",
};

const PROJECT_STATUS_LABELS: Record<string, string> = {
  active: "Actif",
  planning: "En préparation",
  archived: "Archivé",
};

export const ProjectDashboardCard = memo(function ProjectDashboardCard({
  project,
  onEdit,
  onDelete,
}: {
  project: Project;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const gradient = avatarGradient(project.name);

  return (
    <div className="group flex flex-col gap-4 border border-[var(--border)] rounded-xl bg-[var(--bg-body)] p-5 transition-all duration-200 hover:border-[var(--text-xmuted)] hover:shadow-[var(--shadow-sm)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {project.image_url ? (
            <img src={project.image_url} alt={project.name} className="h-12 w-12 shrink-0 rounded-xl object-cover" />
          ) : (
            <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold text-white", gradient)}>
              {initials(project.name).charAt(0) || "P"}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn(PROJECT_STATUS_STYLES[project.status] ?? "badge badge-neutral")}>
                {PROJECT_STATUS_LABELS[project.status] ?? project.status}
              </span>
              {project.created_at ? (
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-xmuted)]">{formatDate(project.created_at)}</span>
              ) : null}
            </div>

            <h2 className="mt-2 truncate font-display text-[1.5rem] italic tracking-[-0.04em] text-[var(--text-strong)]">
              {project.name}
            </h2>
          </div>
        </div>

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              setMenuOpen((value) => !value);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-[var(--text-muted)] transition hover:border-[var(--border)] hover:bg-[var(--bg-panel)] hover:text-[var(--text-strong)]"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {menuOpen ? (
            <div className="absolute right-0 top-10 z-20 min-w-[164px] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-panel-3)] p-1.5 shadow-md">
              <button
                type="button"
                onClick={() => {
                  onEdit(project);
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--text-strong)] transition hover:bg-[var(--bg-panel)]"
              >
                <Pencil className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                Modifier
              </button>
              <button
                type="button"
                onClick={() => {
                  onDelete(project);
                  setMenuOpen(false);
                }}
                className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--danger)] transition hover:bg-[var(--color-rose-50)]"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Supprimer
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {project.description ? (
        <p className="line-clamp-2 text-[13px] leading-6 text-[var(--text-muted)]">
          {project.description}
        </p>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-3">
        <div className="flex items-center gap-1.5 text-[12px] text-[var(--text-xmuted)]">
          <FolderOpen className="h-3.5 w-3.5" />
          <span className="font-mono text-[10px] uppercase tracking-[0.12em]">workspace</span>
        </div>
        <Link to={projectPath(project)}>
          <Button variant="secondary" size="sm">Ouvrir</Button>
        </Link>
      </div>
    </div>
  );
});
