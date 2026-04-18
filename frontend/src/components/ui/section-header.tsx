import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 md:flex-row md:items-end md:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="panel-eyebrow">{eyebrow}</p> : null}
        <h2 className="mt-1 font-display text-[1.25rem] font-bold tracking-[-0.03em] text-[var(--text-strong)]">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

