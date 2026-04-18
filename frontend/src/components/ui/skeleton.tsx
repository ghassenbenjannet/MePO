import type { CSSProperties } from "react";
import { cn } from "../../lib/utils";

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  variant?: "text" | "title" | "circle" | "rect" | "card";
  style?: CSSProperties;
}

export function Skeleton({ className, width, height, variant = "rect", style }: SkeletonProps) {
  const variantClass = {
    text:   "skeleton skeleton-text",
    title:  "skeleton skeleton-title",
    circle: "skeleton skeleton-circle",
    rect:   "skeleton",
    card:   "skeleton skeleton-card",
  }[variant];

  return (
    <div
      className={cn(variantClass, className)}
      style={{ width, height, ...style }}
      aria-hidden="true"
    />
  );
}

/** Full project card skeleton */
export function ProjectCardSkeleton() {
  return (
    <div className="rounded-[24px] border border-[var(--border)] bg-[var(--bg-panel)] p-5 shadow-sm">
      <div className="flex items-start gap-3 mb-4">
        <Skeleton variant="circle" width={44} height={44} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="title" className="w-3/4" />
          <Skeleton variant="text" className="w-1/2" />
        </div>
      </div>
      <Skeleton variant="text" className="w-full mb-1.5" />
      <Skeleton variant="text" className="w-2/3 mb-4" />
      <div className="flex gap-2 pt-3 border-t border-[var(--border)]">
        <Skeleton variant="text" className="w-16 h-6 rounded-full" />
        <Skeleton variant="text" className="w-20 h-6 rounded-full" />
      </div>
    </div>
  );
}

/** Topic / ticket row skeleton */
export function RowSkeleton({ lines = 1 }: { lines?: number }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
      <Skeleton variant="circle" width={28} height={28} className="flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} variant="text" style={{ width: i === 0 ? "60%" : "40%" }} />
        ))}
      </div>
      <Skeleton variant="text" className="w-16 h-5 rounded-full" />
    </div>
  );
}

/** Page-level content skeleton */
export function PageSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-2">
        <Skeleton variant="text" className="w-24 h-4" />
        <Skeleton variant="title" className="w-64 h-8" />
        <Skeleton variant="text" className="w-96 h-4" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-[20px] border border-[var(--border)] bg-[var(--bg-panel)] p-4 shadow-sm">
            <Skeleton variant="text" className="w-20 mb-3" />
            <Skeleton variant="title" className="w-16 h-8 mb-1" />
            <Skeleton variant="text" className="w-32" />
          </div>
        ))}
      </div>
      <div className="rounded-[24px] border border-[var(--border)] bg-[var(--bg-panel)] divide-y divide-[var(--border)]">
        {[1, 2, 3, 4, 5].map((i) => (
          <RowSkeleton key={i} lines={2} />
        ))}
      </div>
    </div>
  );
}
