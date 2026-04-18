import type { ReactNode } from "react";
import { PageHero } from "../ui/page-hero";

export function SpaceOverviewHeader({
  title,
  description,
  meta,
  actions,
}: {
  title: string;
  description?: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <PageHero
      eyebrow="Espace"
      title={title}
      description={description || "Vue de synthèse pour orienter le flux, les topics et les documents sans perdre le contexte."}
      meta={meta}
      actions={actions}
    />
  );
}

