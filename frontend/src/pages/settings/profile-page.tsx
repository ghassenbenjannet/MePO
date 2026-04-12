import { PageHeader } from "../../components/ui/page-header";
import { SectionCard } from "../../components/ui/section-card";
import { useAuthStore } from "../../stores/auth-store";

export function ProfilePage() {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Profil"
        title={user.fullName}
        description="Informations personnelles, preferences d'affichage et parametres IA."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
        <SectionCard title="Informations utilisateur" subtitle="Profil personnel du workspace Shadow PO AI.">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">Nom complet</span>
              <input className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink" defaultValue={user.fullName} />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">Email</span>
              <input className="w-full rounded-2xl border border-line bg-slate-50 px-4 py-3 text-sm text-muted" defaultValue={user.email} disabled />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">Langue</span>
              <select className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink" defaultValue={user.preferredLanguage}>
                <option value="fr">Francais</option>
                <option value="en">English</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">Theme</span>
              <select className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink" defaultValue={user.preferredTheme}>
                <option value="light">Light</option>
              </select>
            </label>
          </div>
        </SectionCard>

        <SectionCard title="Preferences IA" subtitle="Regles de confort d'usage et cadrage des reponses.">
          <div className="space-y-4">
            <div className="rounded-2xl border border-line bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Style</p>
              <p className="mt-2 text-sm text-ink">{user.aiPreferences.responseStyle}</p>
            </div>
            <div className="rounded-2xl border border-line bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Verbosity</p>
              <p className="mt-2 text-sm text-ink">{user.aiPreferences.verbosity}</p>
            </div>
            <div className="rounded-2xl border border-line bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Confidence labels</p>
              <p className="mt-2 text-sm text-ink">{user.aiPreferences.confidenceLabels ? "Enabled" : "Disabled"}</p>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
