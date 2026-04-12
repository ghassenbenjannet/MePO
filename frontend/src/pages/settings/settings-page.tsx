import { PageHeader } from "../../components/ui/page-header";
import { SectionCard } from "../../components/ui/section-card";

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Parametres"
        title="Preferences d'affichage et configuration du workspace"
        description="Le mode clair est la reference principale, avec un mode sombre disponible en complement."
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard title="Affichage" subtitle="Preferences de lecture et densite visuelle.">
          <div className="space-y-3">
            <div className="rounded-2xl border border-line bg-slate-50 p-4 text-sm text-ink dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">Theme clair prioritaire</div>
            <div className="rounded-2xl border border-line bg-slate-50 p-4 text-sm text-ink dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">Mode sombre disponible en complement</div>
            <div className="rounded-2xl border border-line bg-slate-50 p-4 text-sm text-ink dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">Densite standard</div>
            <div className="rounded-2xl border border-line bg-slate-50 p-4 text-sm text-ink dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">Navigation desktop-first</div>
          </div>
        </SectionCard>

        <SectionCard title="Securite" subtitle="Sessions, mots de passe et futures strategies SSO.">
          <div className="space-y-3">
            <div className="rounded-2xl border border-line bg-slate-50 p-4 text-sm text-ink dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">Session persistante active</div>
            <div className="rounded-2xl border border-line bg-slate-50 p-4 text-sm text-ink dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">Reset password prevu</div>
            <div className="rounded-2xl border border-line bg-slate-50 p-4 text-sm text-ink dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">OAuth Google / Microsoft a venir</div>
          </div>
        </SectionCard>

        <SectionCard title="Integrations" subtitle="Preparations pour Jira, Confluence et providers IA futurs.">
          <div className="space-y-3">
            <div className="rounded-2xl border border-line bg-slate-50 p-4 text-sm text-ink dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">Jira import</div>
            <div className="rounded-2xl border border-line bg-slate-50 p-4 text-sm text-ink dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">Confluence import</div>
            <div className="rounded-2xl border border-line bg-slate-50 p-4 text-sm text-ink dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">LLM gateway multi-provider</div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
