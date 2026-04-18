import { Clock } from "lucide-react";
import type { ElementType } from "react";

export function DocumentCard({
  title,
  typeLabel,
  icon: Icon,
  updatedAt,
  onClick,
}: {
  title: string;
  typeLabel: string;
  icon: ElementType;
  updatedAt?: string | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="workspace-card flex items-start gap-3 p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-[rgba(141,140,246,0.18)] hover:shadow-md"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-[var(--violet-light)] text-[var(--color-violet-600)]">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--text-strong)]">{title}</p>
        <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-[var(--text-xmuted)]">{typeLabel}</p>
        {updatedAt ? (
          <p className="mt-2 flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
            <Clock className="h-3 w-3" />
            {updatedAt}
          </p>
        ) : null}
      </div>
    </button>
  );
}
