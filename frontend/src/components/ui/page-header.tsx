import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="max-w-3xl">
        {eyebrow ? <p className="panel-eyebrow">{eyebrow}</p> : null}
        <h1 className={cn("font-display font-bold tracking-[-0.04em] text-ink", eyebrow ? "mt-2 text-[clamp(2rem,2.8vw,2.5rem)]" : "text-[clamp(2rem,2.8vw,2.5rem)]")}>
          {title}
        </h1>
        {description ? <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">{description}</p> : null}
      </div>
      {actions && <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
