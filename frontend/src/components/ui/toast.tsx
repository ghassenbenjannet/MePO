import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../../lib/utils";
import { useNotificationsStore, type Toast } from "../../stores/notifications-store";

// ─── Single toast item ────────────────────────────────────────────────────────

const CONFIG = {
  success: {
    icon: CheckCircle2,
    bar: "bg-emerald-500",
    icon_cls: "text-emerald-500",
    bg: "bg-[var(--bg-panel)] border-emerald-100",
  },
  error: {
    icon: AlertCircle,
    bar: "bg-red-500",
    icon_cls: "text-red-500",
    bg: "bg-[var(--bg-panel)] border-red-100",
  },
  warning: {
    icon: AlertTriangle,
    bar: "bg-amber-400",
    icon_cls: "text-amber-500",
    bg: "bg-[var(--bg-panel)] border-amber-100",
  },
  info: {
    icon: Info,
    bar: "bg-brand-500",
    icon_cls: "text-brand-500",
    bg: "bg-[var(--bg-panel)] border-brand-100",
  },
  action: {
    icon: CheckCircle2,
    bar: "bg-brand-500",
    icon_cls: "text-brand-500",
    bg: "bg-[var(--bg-panel)] border-brand-100",
  },
} as const;

function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = useNotificationsStore((s) => s.removeToast);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger enter animation on mount
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const cfg = CONFIG[toast.type];
  const Icon = cfg.icon;

  return (
    <div
      className={cn(
        "relative flex w-full items-start gap-3 overflow-hidden rounded-2xl border p-4 shadow-float transition-all duration-300",
        cfg.bg,
        visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
      )}
    >
      {/* left accent bar */}
      <div className={cn("absolute inset-y-0 left-0 w-1 rounded-l-2xl", cfg.bar)} />

      <Icon className={cn("mt-0.5 h-4 w-4 flex-shrink-0", cfg.icon_cls)} />

      <div className="flex-1 min-w-0 pl-0.5">
        <p className="text-sm font-semibold text-ink leading-snug">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-xs text-muted leading-relaxed">{toast.description}</p>
        )}
      </div>

      <button
        onClick={() => removeToast(toast.id)}
        className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-lg text-muted transition hover:bg-slate-100 hover:text-ink"
        aria-label="Fermer"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Toast provider — mount once in AppShell ──────────────────────────────────

export function ToastProvider() {
  const toasts = useNotificationsStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-6 right-6 z-[9999] flex w-[380px] max-w-[calc(100vw-2rem)] flex-col-reverse gap-3"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} />
        </div>
      ))}
    </div>
  );
}
