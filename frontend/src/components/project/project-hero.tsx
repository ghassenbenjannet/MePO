import type { ReactNode } from "react";
import { PageHero } from "../ui/page-hero";

export function ProjectHero({
  title,
  description,
  spacesCount,
  knowledgeCount,
  favoriteSpacesCount,
  actions,
}: {
  title: string;
  description?: string;
  spacesCount: number;
  knowledgeCount: number;
  favoriteSpacesCount: number;
  actions?: ReactNode;
}) {
  return (
    <PageHero
      eyebrow="Projet"
      title={title}
      description={description || "Consultez les espaces, la base de connaissance et les réglages du projet."}
      meta={(
        <>
          <span className="badge badge-brand">{spacesCount} espaces</span>
          <span className="badge badge-neutral">{favoriteSpacesCount} favoris</span>
          <span className="badge badge-neutral">{knowledgeCount} éléments knowledge</span>
        </>
      )}
      actions={actions}
    />
  );
}

