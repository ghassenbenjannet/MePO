import {
  Bell,
  Bot,
  Check,
  ChevronRight,
  Clock,
  Globe2,
  Key,
  LayoutGrid,
  LogOut,
  Pencil,
  Shield,
  Sparkles,
  Star,
  User,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/utils";
import { useAuthStore } from "../../stores/auth-store";
import { useNotificationsStore } from "../../stores/notifications-store";
import { useProjects } from "../../hooks/use-projects";
import { projectPath } from "../../lib/routes";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

const AVATAR_GRADIENTS = [
  "from-brand-400 to-brand-700",
  "from-brand-300 to-brand-600",
  "from-brand-500 to-brand-800",
  "from-brand-200 to-brand-700",
];

// ─── Section card ─────────────────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  icon: Icon,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-6 py-5">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50">
              <Icon className="h-4 w-4 text-brand-600" />
            </div>
          )}
          <div>
            <h3 className="text-sm font-semibold text-ink">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

// ─── Field row ────────────────────────────────────────────────────────────────

function FieldRow({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

// ─── Toggle switch ────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2",
        checked ? "bg-brand-600" : "bg-[var(--bg-panel-3)]",
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 translate-y-0.5 rounded-full bg-[var(--bg-panel)] shadow-sm transition-transform duration-200",
          checked ? "translate-x-4" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

// ─── Activity item ────────────────────────────────────────────────────────────

function ActivityItem({
  icon: Icon,
  iconCls,
  label,
  meta,
  to,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconCls: string;
  label: string;
  meta: string;
  to?: string;
}) {
  const inner = (
    <div className="flex items-center gap-3">
      <div className={cn("flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl", iconCls)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium text-ink">{label}</p>
        <p className="text-xs text-muted">{meta}</p>
      </div>
      <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted/50" />
    </div>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="block rounded-xl px-3 py-2.5 transition hover:bg-[var(--bg-panel-2)]"
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className="rounded-xl px-3 py-2.5 opacity-50 cursor-default">
      {inner}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ProfilePage() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const updateAiPreferences = useAuthStore((state) => state.updateAiPreferences);
  const addToast = useNotificationsStore((state) => state.addToast);
  const { data: projects = [] } = useProjects();

  // Local form state
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [language, setLanguage] = useState(user?.preferred_language ?? "fr");
  const [saved, setSaved] = useState(false);

  // AI preferences state
  const aiPrefs = (user?.ai_preferences ?? {}) as Record<string, unknown>;
  const [aiStyle, setAiStyle] = useState<string>(
    (aiPrefs.response_style as string) ?? "balanced",
  );
  const [aiVerbosity, setAiVerbosity] = useState<string>(
    // stored as "detail_level" since v2 — fallback to legacy "verbosity" key
    (aiPrefs.detail_level as string) ?? (aiPrefs.verbosity as string) ?? "normal",
  );
  const [showConfidence, setShowConfidence] = useState<boolean>(
    (aiPrefs.confidence_labels as boolean) ?? true,
  );
  const [showSuggestions, setShowSuggestions] = useState<boolean>(
    (aiPrefs.show_suggestions as boolean) ?? true,
  );
  const [chatOpenByDefault, setChatOpenByDefault] = useState<boolean>(
    (aiPrefs.chat_open_by_default as boolean) ?? false,
  );

  // Interface preferences — must be declared at top level (never inside .map())
  const [prefSidebar, setPrefSidebar] = useState(true);
  const [prefAiPanel, setPrefAiPanel] = useState(true);
  const [prefAnimations, setPrefAnimations] = useState(true);

  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted">
        <p className="text-sm">Chargement du profil…</p>
      </div>
    );
  }

  const initials = getInitials(user.full_name || "?");
  const gradient = AVATAR_GRADIENTS[user.full_name.charCodeAt(0) % AVATAR_GRADIENTS.length];

  function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaved(true);
    addToast({ type: "success", title: "Profil enregistré", description: "Vos informations ont été mises à jour." });
    setTimeout(() => setSaved(false), 2500);
  }

  async function handleSaveAiPrefs() {
    try {
      await updateAiPreferences({
        response_style: aiStyle,
        detail_level: aiVerbosity,   // canonical key — was "verbosity" pre-v2
        confidence_labels: showConfidence,
        show_suggestions: showSuggestions,
        chat_open_by_default: chatOpenByDefault,
      });
      addToast({ type: "success", title: "Préférences IA sauvegardées", description: "Actives dès le prochain message." });
    } catch {
      addToast({ type: "error", title: "Erreur", description: "Impossible de sauvegarder les préférences." });
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] shadow-sm">
        {/* gradient band */}
        <div className={cn("h-24 w-full bg-gradient-to-br", gradient, "opacity-10")} />
        <div className="-mt-12 flex items-end gap-5 px-6 pb-6">
          {/* Avatar */}
          <div
            className={cn(
              "relative flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-xl font-bold text-white shadow-lg ring-4 ring-white",
              gradient,
            )}
          >
            {initials}
            <button className="absolute -right-1.5 -bottom-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--bg-panel)] bg-[var(--bg-panel-2)] text-muted transition hover:bg-brand-50 hover:text-brand-600">
              <Pencil className="h-3 w-3" />
            </button>
          </div>

          {/* Identity */}
          <div className="flex-1 pb-1">
            <h1 className="text-xl font-bold tracking-tight text-ink">
              {user.full_name || "Utilisateur"}
            </h1>
            <p className="text-sm text-muted">{user.email}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                <Sparkles className="h-3 w-3" />
                Product Owner
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <Star className="h-3 w-3" />
                Shadow PO AI
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Personal info ─────────────────────────────────────────────── */}
      <Section
        title="Informations personnelles"
        subtitle="Nom, email et langue d'interface."
        icon={User}
      >
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldRow label="Nom complet">
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="input py-2.5"
              />
            </FieldRow>
            <FieldRow label="Adresse email" hint="L'email ne peut pas être modifié.">
              <input
                value={user.email}
                disabled
                className="input py-2.5 cursor-not-allowed opacity-60"
              />
            </FieldRow>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FieldRow label="Langue">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="input py-2.5"
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </FieldRow>
            <FieldRow label="Rôle">
              <input
                defaultValue="Product Owner"
                className="input py-2.5"
              />
            </FieldRow>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
                saved
                  ? "bg-emerald-500 text-white"
                  : "bg-brand-500 text-white hover:bg-brand-600",
              )}
            >
              {saved ? (
                <>
                  <Check className="h-4 w-4" />
                  Enregistré
                </>
              ) : (
                "Enregistrer"
              )}
            </button>
          </div>
        </form>
      </Section>

      {/* ── Interface preferences ─────────────────────────────────────── */}
      <Section
        title="Préférences d'interface"
        subtitle="Thème, densité et comportement de l'application."
        icon={LayoutGrid}
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldRow label="Thème">
              <select
                defaultValue="light"
                className="input py-2.5"
              >
                <option value="light">Clair (Light)</option>
                <option value="dark">Sombre (Dark) — bientôt</option>
                <option value="system">Système</option>
              </select>
            </FieldRow>
            <FieldRow label="Densité d'affichage">
              <select
                defaultValue="comfortable"
                className="input py-2.5"
              >
                <option value="compact">Compact</option>
                <option value="comfortable">Confortable</option>
                <option value="spacious">Spacieux</option>
              </select>
            </FieldRow>
          </div>

          <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] p-4">
            {[
              { label: "Sidebar ouverte par défaut", val: prefSidebar, set: setPrefSidebar },
              { label: "Panneau IA visible au démarrage", val: prefAiPanel, set: setPrefAiPanel },
              { label: "Animations de transitions", val: prefAnimations, set: setPrefAnimations },
            ].map((pref) => (
              <div key={pref.label} className="flex items-center justify-between gap-4">
                <span className="text-sm text-ink">{pref.label}</span>
                <Toggle checked={pref.val} onChange={pref.set} />
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── AI preferences ────────────────────────────────────────────── */}
      <Section
        title="Préférences IA"
        subtitle="Cadrage de Shadow Core — style de réponse, niveau de détail, affichage."
        icon={Bot}
        action={
          <button
            onClick={handleSaveAiPrefs}
            className="btn-ghost border border-[var(--border)] px-3 py-1.5 text-xs hover:border-brand-200 hover:text-brand-600"
          >
            Enregistrer
          </button>
        }
      >
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldRow label="Style de réponse">
              <select
                value={aiStyle}
                onChange={(e) => setAiStyle(e.target.value)}
                className="input py-2.5"
              >
                <option value="concise">Concis</option>
                <option value="balanced">Équilibré</option>
                <option value="detailed">Détaillé</option>
                <option value="expert">Expert PO</option>
              </select>
            </FieldRow>
            <FieldRow label="Niveau de détail">
              <select
                value={aiVerbosity}
                onChange={(e) => setAiVerbosity(e.target.value)}
                className="input py-2.5"
              >
                <option value="minimal">Minimal</option>
                <option value="normal">Normal</option>
                <option value="verbose">Verbeux</option>
              </select>
            </FieldRow>
          </div>

          <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-ink">Blocs de confiance</p>
                <p className="mt-0.5 text-xs text-muted">Afficher certain / déduit / à confirmer</p>
              </div>
              <Toggle checked={showConfidence} onChange={setShowConfidence} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-ink">Actions proposées</p>
                <p className="mt-0.5 text-xs text-muted">Créer ticket, document, mettre à jour mémoire…</p>
              </div>
              <Toggle checked={showSuggestions} onChange={setShowSuggestions} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-ink">Let's Chat ouvert par défaut</p>
                <p className="mt-0.5 text-xs text-muted">Ouvrir le panneau IA à l'arrivée sur un espace</p>
              </div>
              <Toggle checked={chatOpenByDefault} onChange={setChatOpenByDefault} />
            </div>
          </div>
        </div>
      </Section>

      {/* ── Activité récente ──────────────────────────────────────────── */}
      <Section
        title="Activité récente"
        subtitle="Projets, espaces et conversations IA consultés récemment."
        icon={Clock}
      >
        <div className="space-y-1">
          {projects.slice(0, 3).map((p) => (
            <ActivityItem
              key={p.id}
              icon={LayoutGrid}
              iconCls="bg-brand-50 text-brand-600"
              label={p.name}
              meta="Projet"
              to={projectPath(p)}
            />
          ))}
          {projects.length === 0 && (
            <ActivityItem
              icon={LayoutGrid}
              iconCls="bg-[var(--bg-panel-3)] text-[var(--text-muted)]"
              label="Aucun projet récent"
              meta="Créez votre premier projet"
            />
          )}
          <ActivityItem
            icon={Sparkles}
            iconCls="bg-brand-50 text-brand-600"
            label="Conversation Shadow Core"
            meta="Analyse des risques sprint — aujourd'hui"
          />
          <ActivityItem
            icon={Bell}
            iconCls="bg-amber-50 text-amber-600"
            label="Voir les notifications"
            meta="3 notifications non lues"
            to="/"
          />
        </div>
      </Section>

      {/* ── Sécurité ──────────────────────────────────────────────────── */}
      <Section
        title="Sécurité & session"
        subtitle="Gestion de la session et de l'authentification."
        icon={Shield}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] px-4 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50">
                <Globe2 className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-ink">Session active</p>
                <p className="text-xs text-muted">Navigateur local · maintenant</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Active
            </span>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--bg-panel-2)] px-4 py-3.5 opacity-60">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--bg-panel-3)]">
                <Key className="h-4 w-4 text-muted" />
              </div>
              <div>
                <p className="text-sm font-medium text-ink">Changer le mot de passe</p>
                <p className="text-xs text-muted">Disponible prochainement</p>
              </div>
            </div>
            <span className="text-xs text-muted">Bientôt</span>
          </div>

          <div className="pt-2">
            <button
              onClick={() => {
                logout();
                window.location.href = "/login";
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100"
            >
              <LogOut className="h-4 w-4" />
              Se déconnecter
            </button>
          </div>
        </div>
      </Section>
    </div>
  );
}
