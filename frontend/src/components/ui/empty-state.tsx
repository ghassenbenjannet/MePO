import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("empty-state", className)}>
      {icon ? <div className="empty-state-icon">{icon}</div> : null}
      <div>
        <p className="empty-state-title">{title}</p>
        <p className="empty-state-description">{description}</p>
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
