import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg" | "icon";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "btn-primary",
  secondary:
    "btn-secondary",
  outline:
    "border border-[var(--border)] bg-transparent text-[var(--text-strong)] hover:border-brand-300 hover:bg-brand-50/60 hover:text-brand-700",
  ghost:
    "btn-ghost",
  danger:
    "btn-danger",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-8 rounded-xl px-3 text-xs font-semibold",
  md: "h-10 rounded-2xl px-4 text-sm font-semibold",
  lg: "h-11 rounded-2xl px-5 text-sm font-semibold",
  icon: "h-10 w-10 rounded-2xl p-0",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export function Button({
  className,
  variant = "secondary",
  size = "md",
  leadingIcon,
  trailingIcon,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap transition duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100",
        "active:translate-y-px",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </button>
  );
}
