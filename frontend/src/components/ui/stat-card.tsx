import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { Surface } from "./surface";

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: "neutral" | "brand" | "success" | "warning" | "danger" | "violet";
  className?: string;
}) {
  const iconTone =
    tone === "brand"
      ? "bg-[var(--brand-light)] text-[var(--brand-dark)]"
      : tone === "success"
        ? "bg-[var(--color-emerald-50)] text-[#5D9B6D]"
        : tone === "warning"
          ? "bg-[var(--color-amber-50)] text-[#B78735]"
          : tone === "danger"
            ? "bg-[var(--color-rose-50)] text-[var(--danger)]"
            : tone === "violet"
              ? "bg-[var(--violet-light)] text-[var(--color-violet-600)]"
              : "bg-[var(--bg-panel)] text-[var(--text-muted)]";

  return (
    <Surface className={cn("overflow-hidden px-5 py-5", className)}>
      <div className="mb-4 h-px w-full bg-[linear-gradient(90deg,rgba(228,225,217,0),rgba(228,225,217,1),rgba(228,225,217,0))]" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-xmuted)]">
            {label}
          </p>
          <p className="mt-3 font-display text-[2.35rem] italic leading-none tracking-[-0.06em] text-[var(--text-strong)]">
            {value}
          </p>
          {hint ? <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{hint}</p> : null}
        </div>
        {icon ? (
          <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]", iconTone)}>
            {icon}
          </div>
        ) : null}
      </div>
      <div className="mt-4 h-px w-full bg-[linear-gradient(90deg,rgba(228,225,217,0),rgba(228,225,217,1),rgba(228,225,217,0))]" />
    </Surface>
  );
}
