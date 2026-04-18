import { cn } from "../../lib/utils";
import type { ReactNode } from "react";

interface KpiCardProps {
  label: string;
  value: string;
  detail: string;
  icon?: ReactNode;
  accent?: string;
  className?: string;
}

export function KpiCard({ label, value, detail, icon, accent, className }: KpiCardProps) {
  return (
    <div className={cn(
      "group relative overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--bg-panel)] px-5 py-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md",
      className,
    )}>
      {/* Hover glow */}
      <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100"
        style={{ background: "linear-gradient(135deg, rgba(215,179,16,0.09) 0%, rgba(255,255,255,0) 42%, transparent 78%)" }} />

      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
            {label}
          </p>
          <p className="mt-2 font-display text-3xl font-extrabold tracking-tight text-[var(--text-strong)]">
            {value}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{detail}</p>
        </div>
        {icon && (
          <div className={cn(
            "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-white/70 shadow-[0_10px_24px_rgba(15,23,42,0.05)]",
            accent ?? "bg-brand-50",
          )}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
