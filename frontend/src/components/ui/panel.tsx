import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("surface-panel", className)} {...props} />;
}

export function PanelHeader({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 border-b border-line px-6 py-5",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function PanelHeading({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      {eyebrow ? <p className="panel-eyebrow">{eyebrow}</p> : null}
      <h3 className="panel-title">{title}</h3>
      {description ? <p className="panel-description">{description}</p> : null}
    </div>
  );
}

export function PanelContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-6 py-5", className)} {...props} />;
}

export function PanelFooter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-3 border-t border-line px-6 py-4",
        className,
      )}
      {...props}
    />
  );
}
