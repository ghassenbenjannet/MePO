import type { ReactNode } from "react";
import { PageHero } from "../ui/page-hero";

export function TopicHero({
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
      eyebrow="Topic"
      title={title}
      description={description}
      meta={meta}
      actions={actions}
    />
  );
}
