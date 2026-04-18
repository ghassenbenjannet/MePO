import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export function FilterBar({
  primary,
  secondary,
  summary,
  className,
}: {
  primary: ReactNode;
  secondary?: ReactNode;
  summary?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("surface-panel px-4 py-4 sm:px-5", className)}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">{primary}</div>
          {summary ? <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">{summary}</div> : null}
        </div>
        {secondary ? <div className="flex flex-wrap items-end gap-3 border-t border-[var(--border-subtle)] pt-3">{secondary}</div> : null}
      </div>
    </div>
  );
}

