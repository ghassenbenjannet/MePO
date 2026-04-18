import { cn } from "../../lib/utils";

const TONE_CLASSES = {
  neutral: "border-[var(--border)] bg-[var(--bg-panel)] text-[var(--text-muted)]",
  brand: "border-brand-200 bg-brand-50 text-brand-700",
  success: "border-emerald-100 bg-emerald-50 text-[#5D9B6D]",
  warning: "border-amber-100 bg-amber-50 text-[#B78735]",
  danger: "border-rose-100 bg-rose-50 text-[var(--danger)]",
  info: "border-sky-100 bg-sky-50 text-[#5A86C9]",
} as const;

export function StatusBadge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: keyof typeof TONE_CLASSES;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold", TONE_CLASSES[tone], className)}>
      {children}
    </span>
  );
}
