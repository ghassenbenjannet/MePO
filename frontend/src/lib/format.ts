/** Shared formatting utilities — eliminates duplication across pages. */

/** "John Doe" → "JD" */
export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

const AVATAR_GRADIENTS = [
  "from-brand-400 to-brand-700",
  "from-orange-400 to-brand-700",
  "from-amber-400 to-brand-700",
  "from-rose-400 to-brand-700",
  "from-zinc-500 to-brand-800",
  "from-brand-500 to-zinc-800",
  "from-orange-300 to-zinc-700",
];

/** Deterministic gradient class for an entity name */
export function avatarGradient(name: string): string {
  const hash = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

/** ISO date string → "14 avr. 2026" */
export function formatDate(iso: string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...opts,
  });
}

/** ISO date → "14/04/2026" */
export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

/** ISO date → relative "il y a 3j" */
export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days}j`;
  return formatDate(iso);
}

/** Truncate a string to maxLen chars */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "…";
}

const STATUS_CONFIGS: Record<string, { label: string; color: string }> = {
  active:    { label: "Actif",           color: "emerald" },
  planning:  { label: "En préparation",  color: "amber"   },
  archived:  { label: "Archivé",         color: "slate"   },
  done:      { label: "Terminé",         color: "emerald" },
  blocked:   { label: "Bloqué",          color: "rose"    },
  backlog:   { label: "Backlog",         color: "slate"   },
  todo:      { label: "À faire",         color: "slate"   },
  in_progress: { label: "En cours",     color: "amber"   },
  review:    { label: "En revue",        color: "brand"   },
};

export function statusLabel(status: string): string {
  return STATUS_CONFIGS[status]?.label ?? status;
}

export function statusColor(status: string): string {
  return STATUS_CONFIGS[status]?.color ?? "slate";
}

const PRIORITY_CONFIGS: Record<string, { label: string; color: string }> = {
  low:      { label: "Bas",      color: "slate"   },
  medium:   { label: "Moyen",    color: "brand"   },
  high:     { label: "Élevé",    color: "amber"   },
  critical: { label: "Critique", color: "rose"    },
};

export function priorityLabel(p: string): string {
  return PRIORITY_CONFIGS[p]?.label ?? p;
}

export function priorityColor(p: string): string {
  return PRIORITY_CONFIGS[p]?.color ?? "slate";
}

const TOPIC_NATURE_CONFIGS: Record<string, { label: string; icon: string }> = {
  study:          { label: "Étude",           icon: "🔍" },
  delivery:       { label: "Livraison",        icon: "🚀" },
  study_delivery: { label: "Étude + Livraison", icon: "🔍🚀" },
};

export function topicNatureLabel(n: string): string {
  return TOPIC_NATURE_CONFIGS[n]?.label ?? n;
}
export function topicNatureIcon(n: string): string {
  return TOPIC_NATURE_CONFIGS[n]?.icon ?? "📋";
}
