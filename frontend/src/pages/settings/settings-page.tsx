import {
  Bot,
  Blocks,
  Globe2,
  Key,
  LayoutGrid,
  Link2,
  Palette,
  Shield,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../components/ui/page-header";

// ─── Setting row ──────────────────────────────────────────────────────────────

function SettingRow({
  label,
  description,
  value,
  badge,
}: {
  label: string;
  description?: string;
  value?: string;
  badge?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] py-3.5 last:border-0">
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        {value && <span className="text-sm text-muted">{value}</span>}
        {badge && (
          <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700">
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Settings section ─────────────────────────────────────────────────────────

function SettingsSection({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] shadow-sm">
      <div className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50">
          <Icon className="h-4 w-4 text-brand-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
        </div>
      </div>
      <div className="px-5">{children}</div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Configuration"
        title="Paramètres"
        description="Paramètres globaux de l'application."
        actions={
          <Link to="/profile" className="btn-secondary text-sm">
            <Sparkles className="h-4 w-4" />
            Voir le profil
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Affichage */}
        <SettingsSection icon={Palette} title="Affichage" subtitle="Thème et densité visuelle">
          <SettingRow label="Thème actif" value="Clair (Light)" badge="Actif" />
          <SettingRow label="Mode sombre" description="Disponible prochainement" badge="Bientôt" />
          <SettingRow label="Densité" value="Confortable" />
          <SettingRow label="Navigation" value="Desktop-first" />
        </SettingsSection>

        {/* IA */}
        <SettingsSection icon={Bot} title="Shadow PO AI" subtitle="Moteur IA et modèle actif">
          <SettingRow label="Modèle IA" value="Configuré par OPENAI_MODEL" badge="Env" />
          <SettingRow label="Contexte" description="Injection espace + sujets + tickets" value="Activé" />
          <SettingRow label="Modes" description="8 modes Shadow Core disponibles" value="Tous actifs" />
          <SettingRow label="Fallback" description="Mode démo si clé absente" badge="OK" />
        </SettingsSection>

        {/* Sécurité */}
        <SettingsSection icon={Shield} title="Sécurité" subtitle="Authentification et sessions">
          <SettingRow label="Authentification" value="JWT" badge="Actif" />
          <SettingRow label="Session persistante" value="Activée" />
          <SettingRow label="Reset password" description="Géré dans le profil" badge="Bientôt" />
          <SettingRow label="OAuth" description="Google · Microsoft" badge="Prévu" />
        </SettingsSection>

        {/* Intégrations */}
        <SettingsSection icon={Link2} title="Intégrations" subtitle="Import et connecteurs externes">
          <SettingRow label="Jira import" description="Tickets et epics" badge="Prévu" />
          <SettingRow label="Confluence import" description="Pages et espaces" badge="Prévu" />
          <SettingRow label="LLM multi-provider" description="OpenAI · Anthropic · Azure" badge="Prévu" />
          <SettingRow label="API REST" description="Accès programmatique" badge="Bientôt" />
        </SettingsSection>

        {/* Layout */}
        <SettingsSection icon={LayoutGrid} title="Workspace" subtitle="Structure et organisation">
          <SettingRow label="Structure" value="Projets → Espaces → Sujets" />
          <SettingRow label="Sidebar" value="Navigation contextuelle" />
          <SettingRow label="Panneau latéral" description="Volet de détail et d'assistance" value="Activé" />
          <SettingRow label="Documents" description="Pages · Whiteboard · Mermaid" value="Actifs" />
        </SettingsSection>

        {/* Stack */}
        <SettingsSection icon={Blocks} title="Stack technique" subtitle="Technologies et versions">
          <SettingRow label="Frontend" value="React 18 + Vite + TypeScript" />
          <SettingRow label="Backend" value="FastAPI + SQLAlchemy + PostgreSQL" />
          <SettingRow label="Infra" description="Docker Compose" value="Local / Dev" />
          <SettingRow label="Cache" value="Redis 7" />
        </SettingsSection>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-brand-100 bg-brand-50/40 px-5 py-4">
        <Globe2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-500" />
        <div>
          <p className="text-sm font-medium text-brand-800">Shadow PO AI — version dev</p>
          <p className="mt-0.5 text-xs text-brand-700/70">
            Application en développement actif. Certaines fonctionnalités sont en cours d'implémentation.
            Configurez votre profil et vos préférences IA dans{" "}
            <Link to="/profile" className="font-semibold underline underline-offset-2 hover:text-brand-800">
              Profil utilisateur
            </Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
