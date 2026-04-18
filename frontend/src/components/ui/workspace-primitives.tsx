import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

export function WorkspaceHero({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[32px] border border-[var(--border)] bg-[var(--bg-panel)] px-6 py-6 shadow-md lg:px-8 lg:py-8",
        "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-32 before:bg-[linear-gradient(135deg,rgba(79,70,229,0.11),rgba(14,165,233,0.04)_48%,transparent_78%)]",
        "after:pointer-events-none after:absolute after:right-[-10%] after:top-[-25%] after:h-52 after:w-52 after:rounded-full after:bg-[radial-gradient(circle,rgba(99,102,241,0.15),transparent_68%)]",
        className,
      )}
      {...props}
    >
      <div className="relative z-[1]">{children}</div>
    </section>
  );
}

export function WorkspaceEyebrow({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        "text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-600",
        className,
      )}
      {...props}
    >
      {children}
    </p>
  );
}

export function WorkspaceTitle({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1
      className={cn(
        "mt-3 font-display text-[2rem] font-extrabold tracking-[-0.045em] text-ink lg:text-[2.4rem]",
        className,
      )}
      {...props}
    >
      {children}
    </h1>
  );
}

export function WorkspaceDescription({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        "mt-3 max-w-3xl text-sm leading-7 text-muted lg:text-[15px]",
        className,
      )}
      {...props}
    >
      {children}
    </p>
  );
}

export function WorkspaceMetric({
  label,
  value,
  hint,
  accent,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  accent?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[24px] border border-line bg-white/92 px-4 py-4 shadow-sm backdrop-blur-sm",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
          {label}
        </p>
        {accent}
      </div>
      <p className="mt-3 text-[1.85rem] font-display font-extrabold tracking-[-0.04em] text-ink">
        {value}
      </p>
      {hint ? (
        <p className="mt-1.5 text-xs leading-relaxed text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function WorkspaceSection({
  title,
  description,
  actions,
  className,
  children,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-[30px] border border-line bg-white/92 p-5 shadow-[0_16px_48px_rgba(15,23,42,0.06)] lg:p-6",
        className,
      )}
    >
      <div className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.03em] text-ink">
            {title}
          </h2>
          {description ? (
            <p className="mt-1.5 max-w-3xl text-sm leading-6 text-muted">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="pt-5">{children}</div>
    </section>
  );
}

export function WorkspaceRailCard({
  title,
  eyebrow,
  description,
  className,
  children,
}: {
  title: string;
  eyebrow?: string;
  description?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-[26px] border border-line bg-white/92 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]",
        className,
      )}
    >
      {eyebrow ? (
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-600">
          {eyebrow}
        </p>
      ) : null}
      <h3 className="mt-2 text-base font-semibold tracking-[-0.02em] text-ink">
        {title}
      </h3>
      {description ? (
        <p className="mt-1.5 text-sm leading-6 text-muted">{description}</p>
      ) : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
