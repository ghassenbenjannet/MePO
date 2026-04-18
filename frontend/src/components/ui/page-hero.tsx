import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export function PageHero({
  eyebrow,
  title,
  description,
  meta,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "border-b border-[var(--border)] pb-6 pt-2",
        className,
      )}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 max-w-3xl">
          {eyebrow ? (
            <p className="eyebrow">{eyebrow}</p>
          ) : null}
          <h1 className="proj-hero mt-2">
            {title}
          </h1>
          {description ? (
            <p className="mt-4 max-w-2xl text-[14px] leading-7 text-[var(--text-muted)]">
              {description}
            </p>
          ) : null}
          {meta ? <div className="mt-4 flex flex-wrap items-center gap-2.5">{meta}</div> : null}
        </div>

        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2.5 lg:pb-1">{actions}</div>
        ) : null}
      </div>
    </section>
  );
}
