import {
  AlertCircle,
  AlertTriangle,
  Bell,
  BrainCircuit,
  CheckCircle2,
  Info,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import {
  useNotificationsStore,
  type AppNotification,
  type NotifCategory,
} from "../../stores/notifications-store";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return "À l'instant";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}j`;
}

const TYPE_ICON = {
  success: { Icon: CheckCircle2, cls: "text-emerald-500 bg-emerald-50" },
  error: { Icon: AlertCircle, cls: "text-red-500 bg-red-50" },
  warning: { Icon: AlertTriangle, cls: "text-amber-500 bg-amber-50" },
  info: { Icon: Info, cls: "text-blue-500 bg-blue-50" },
  action: { Icon: Sparkles, cls: "text-brand-500 bg-brand-50" },
} as const;

// ─── Notification row ─────────────────────────────────────────────────────────

function NotifRow({ notif }: { notif: AppNotification }) {
  const { markAsRead, clearNotification } = useNotificationsStore();
  const cfg = TYPE_ICON[notif.type];
  const Icon = cfg.Icon;

  return (
    <div
      className={cn(
        "group relative flex items-start gap-3 px-4 py-3.5 transition-colors",
        "hover:bg-slate-50",
        !notif.read && "bg-brand-50/30",
      )}
      onClick={() => !notif.read && markAsRead(notif.id)}
    >
      {/* unread dot */}
      {!notif.read && (
        <span className="absolute left-2 top-[18px] h-1.5 w-1.5 rounded-full bg-brand-500" />
      )}

      {/* icon */}
      <div className={cn("mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl", cfg.cls)}>
        <Icon className="h-4 w-4" />
      </div>

      {/* content */}
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm leading-snug text-ink", !notif.read && "font-semibold")}>
          {notif.title}
        </p>
        {notif.description && (
          <p className="mt-0.5 text-xs leading-relaxed text-muted line-clamp-2">
            {notif.description}
          </p>
        )}
        <p className="mt-1 text-[11px] text-muted/70">{timeAgo(notif.createdAt)}</p>
      </div>

      {/* dismiss */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          clearNotification(notif.id);
        }}
        className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-lg text-muted opacity-0 transition hover:bg-slate-200 hover:text-ink group-hover:opacity-100"
        aria-label="Supprimer"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const TABS: { key: "all" | NotifCategory; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "all", label: "Toutes", Icon: Bell },
  { key: "product", label: "Produit", Icon: CheckCircle2 },
  { key: "ai", label: "IA", Icon: BrainCircuit },
];

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | NotifCategory>("all");
  const ref = useRef<HTMLDivElement>(null);

  const { notifications, unreadCount, markAllAsRead, clearAll } = useNotificationsStore();

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = notifications.filter(
    (n) => activeTab === "all" || n.category === activeTab,
  );

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-xl border transition",
          open
            ? "border-brand-200 bg-brand-50 text-brand-600"
            : "border-slate-200 bg-white text-muted hover:border-slate-300 hover:bg-slate-50 hover:text-ink",
        )}
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          className={cn(
            "absolute right-0 top-[calc(100%+10px)] z-50 w-[420px] max-w-[calc(100vw-2rem)]",
            "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-float",
            "animate-dropdown",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <Bell className="h-4 w-4 text-muted" />
              <span className="text-sm font-semibold text-ink">Notifications</span>
              {unreadCount > 0 && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-500 px-1.5 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs font-medium text-brand-600 transition hover:text-brand-700"
                >
                  Tout marquer lu
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-xs text-muted transition hover:text-ink"
                >
                  Effacer
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-slate-100 px-3 py-2">
            {TABS.map((tab) => {
              const count =
                tab.key === "all"
                  ? notifications.filter((n) => !n.read).length
                  : notifications.filter((n) => n.category === tab.key && !n.read).length;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
                    activeTab === tab.key
                      ? "bg-brand-50 text-brand-700"
                      : "text-muted hover:bg-slate-50 hover:text-ink",
                  )}
                >
                  {tab.label}
                  {count > 0 && (
                    <span
                      className={cn(
                        "flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold",
                        activeTab === tab.key
                          ? "bg-brand-500 text-white"
                          : "bg-slate-200 text-muted",
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* List */}
          <div className="max-h-[440px] overflow-y-auto divide-y divide-slate-50">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                  <Bell className="h-5 w-5 text-muted" />
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">Aucune notification</p>
                  <p className="mt-0.5 text-xs text-muted">Tout est à jour ✓</p>
                </div>
              </div>
            ) : (
              filtered.map((n) => <NotifRow key={n.id} notif={n} />)
            )}
          </div>
        </div>
      )}
    </div>
  );
}
