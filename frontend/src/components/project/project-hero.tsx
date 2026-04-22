import type { ReactNode } from "react";
import { PageHero } from "../ui/page-hero";

export function ProjectHero({
  title,
  description,
  spacesCount,
  aiContextCount,
  favoriteSpacesCount,
  actions,
}: {
  title: string;
  description?: string;
  spacesCount: number;
  aiContextCount: number;
  favoriteSpacesCount: number;
  actions?: ReactNode;
}) {
  return (
    <PageHero
      eyebrow="Projet"
      title={title}
      description={description || "Consultez les espaces et la configuration IA du projet."}
      meta={(
        <>
          <span className="badge badge-brand">{spacesCount} espaces</span>
          <span className="badge badge-neutral">{favoriteSpacesCount} favoris</span>
          <span className="badge badge-neutral">{aiContextCount} contexte IA</span>
        </>
      )}
      actions={actions}
    />
  );
}
