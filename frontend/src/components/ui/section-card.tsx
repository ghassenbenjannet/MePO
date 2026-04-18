import type { ReactNode } from "react";
import { Panel, PanelContent, PanelHeader, PanelHeading } from "./panel";

interface SectionCardProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SectionCard({ title, subtitle, action, children, className }: SectionCardProps) {
  return (
    <Panel className={className}>
      <PanelHeader>
        <PanelHeading title={title} description={subtitle} className="max-w-2xl [&_.panel-title]:mt-0 [&_.panel-title]:text-base" />
        {action}
      </PanelHeader>
      <PanelContent>{children}</PanelContent>
    </Panel>
  );
}
