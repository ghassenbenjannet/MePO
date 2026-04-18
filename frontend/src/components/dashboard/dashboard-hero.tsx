import { Plus } from "lucide-react";
import { Button } from "../ui/button";
import { useAuthStore } from "../../stores/auth-store";

function firstNameOf(fullName: string | undefined) {
  return fullName?.trim().split(/\s+/)[0] ?? "Maryam";
}

export function DashboardHero({
  projectCount,
  activeCount,
  onCreate,
}: {
  projectCount: number;
  activeCount: number;
  onCreate: () => void;
}) {
  const user = useAuthStore((state) => state.user);
  const firstName = firstNameOf(user?.full_name);
  const planningCount = Math.max(projectCount - activeCount, 0);
  const activationRate = projectCount > 0 ? Math.round((activeCount / projectCount) * 100) : 0;
  const cells = [
    { label: "Décisions", value: String(projectCount).padStart(2, "0"), tone: "text-[var(--text-strong)]" },
    { label: "Activation", value: `${activationRate}%`, tone: "text-[var(--text-strong)]" },
    { label: "À cadrer", value: String(planningCount).padStart(2, "0"), tone: "text-brand-600" },
    { label: "Actifs", value: String(activeCount).padStart(2, "0"), tone: "text-[var(--text-strong)]" },
  ];

  return (
    <section className="border-b border-[var(--border)] pb-7 pt-1">
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] xl:items-end">
        <div className="min-w-0">
          <p className="eyebrow">Cockpit</p>
          <h1 className="proj-hero mt-2">
            {`Bonjour ${firstName},`}
          </h1>
          <p className="mt-5 max-w-2xl text-[14px] leading-7 text-[var(--text-muted)]">
            {activeCount > 0
              ? `${activeCount} projet${activeCount > 1 ? "s" : ""} actif${activeCount > 1 ? "s" : ""} · ${planningCount > 0 ? `${planningCount} en cadrage` : "tous opérationnels"}.`
              : "Commencez par créer votre premier projet."}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button type="button" variant="primary" size="md" onClick={onCreate} leadingIcon={<Plus className="h-4 w-4" />}>
              Nouveau projet
            </Button>
          </div>
        </div>

        <div className="ledger sm:grid-cols-2">
          {cells.map((cell) => (
            <div key={cell.label} className="ledger-cell">
              <p className="ledger-cell-label">{cell.label}</p>
              <p className={`ledger-cell-value ${cell.tone}`}>{cell.value}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
