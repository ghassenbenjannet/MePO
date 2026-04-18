import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

type SurfaceTone = "default" | "muted" | "strong";

const SURFACE_TONE_CLASSES: Record<SurfaceTone, string> = {
  default: "bg-[var(--bg-panel-3)] border-[var(--border)] shadow-sm",
  muted: "bg-[var(--bg-panel)] border-[var(--border-subtle)] shadow-sm",
  strong: "bg-[var(--bg-panel-3)] border-[var(--border)] shadow-md",
};

export function Surface({
  tone = "default",
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { tone?: SurfaceTone; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-[20px] border text-[var(--text)]",
        SURFACE_TONE_CLASSES[tone],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function SurfaceHeader({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 py-5", className)} {...props}>
      {children}
    </div>
  );
}

export function SurfaceContent({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={cn("px-5 pb-5", className)} {...props}>
      {children}
    </div>
  );
}
