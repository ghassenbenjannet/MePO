import type { ReactNode } from "react";
import { SectionHeader } from "../ui/section-header";

export function KpiSection({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <SectionHeader
        eyebrow="Pilotage"
        title="Vue portefeuille"
        description="Seulement les signaux nécessaires pour arbitrer vite, sans transformer le dashboard en cockpit surchargé."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
  );
}
