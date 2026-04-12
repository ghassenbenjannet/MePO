import { PageHeader } from "../../components/ui/page-header";
import { SectionCard } from "../../components/ui/section-card";

export function OnboardingPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        eyebrow="First run"
        title="Create your first product workspace"
        description="A lightweight onboarding: one project, one space, then choose whether to start clean or import your existing tools."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <SectionCard title="Start in under 2 minutes" subtitle="Set the product structure, then move into execution.">
          <div className="space-y-4">
            {[
              "1. Creer un premier projet",
              "2. Ajouter un premier espace de travail",
              "3. Choisir un point de depart",
              "4. Decouvrir Suivi, Documents et Let's Chat",
            ].map((step) => (
              <div key={step} className="rounded-2xl border border-line bg-slate-50 px-4 py-4 text-sm text-ink">
                {step}
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Quick setup" subtitle="Minimal information to create your first PO workspace.">
          <div className="space-y-4">
            <input className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink" placeholder="Nom du projet" />
            <textarea className="min-h-28 w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink" placeholder="Description courte" />
            <input className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink" placeholder="Premier espace, ex: S1 2026" />
            <div className="grid gap-3">
              {["Demarrer a zero", "Importer Jira", "Importer Confluence"].map((option) => (
                <button key={option} className="rounded-2xl border border-line bg-white px-4 py-3 text-left text-sm font-medium text-ink transition hover:bg-slate-50">
                  {option}
                </button>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
