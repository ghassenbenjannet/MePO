interface KpiCardProps {
  label: string;
  value: string;
  detail: string;
}

export function KpiCard({ label, value, detail }: KpiCardProps) {
  return (
    <div className="rounded-3xl border border-line bg-panel p-5 shadow-panel dark:border-slate-800 dark:bg-slate-950">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted dark:text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-ink dark:text-white">{value}</p>
      <p className="mt-2 text-sm text-muted dark:text-slate-400">{detail}</p>
    </div>
  );
}
