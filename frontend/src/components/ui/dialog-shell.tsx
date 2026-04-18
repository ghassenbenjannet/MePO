import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { Button } from "./button";

export function DialogShell({
  size = "lg",
  children,
}: {
  size?: "sm" | "md" | "lg" | "xl" | "full";
  children: ReactNode;
}) {
  const maxWidth =
    size === "sm" ? "max-w-md" :
    size === "md" ? "max-w-lg" :
    size === "lg" ? "max-w-2xl" :
    size === "xl" ? "max-w-4xl" :
    "max-w-[calc(100vw-2rem)]";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/34 p-4 backdrop-blur-sm">
      <div className="flex min-h-full items-start justify-center py-8">
        <div className={cn("dialog-panel w-full", maxWidth)}>{children}</div>
      </div>
    </div>
  );
}

export function DialogHeader({
  eyebrow,
  title,
  description,
  onClose,
  closeLabel = "Fermer",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  onClose?: () => void;
  closeLabel?: string;
}) {
  return (
    <div className="dialog-header">
      <div className="min-w-0">
        {eyebrow ? <p className="panel-eyebrow">{eyebrow}</p> : null}
        <h2 className="dialog-title">{title}</h2>
        {description ? <p className="dialog-description">{description}</p> : null}
      </div>
      {onClose ? <Button variant="secondary" size="sm" onClick={onClose}>{closeLabel}</Button> : null}
    </div>
  );
}

export function DialogBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("dialog-body", className)}>{children}</div>;
}

export function DialogFooter({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("dialog-footer", className)}>{children}</div>;
}
