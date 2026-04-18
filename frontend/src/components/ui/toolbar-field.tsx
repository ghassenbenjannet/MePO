import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export function ToolbarField({
  label,
  children,
  className,
}: {
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      {label ? (
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-xmuted)]">
          {label}
        </span>
      ) : null}
      {children}
    </div>
  );
}

