import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

type TabItem<T extends string> = {
  id: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: ReactNode;
};

export function TabsBar<T extends string>({
  items,
  value,
  onChange,
  compact = false,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  compact?: boolean;
}) {
  return (
    <div className="tabs-shell">
      {items.map(({ id, label, icon: Icon, badge }) => {
        const active = id === value;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={cn("tab-trigger", active && "tab-trigger-active", compact && "!px-3 !py-1.5 !text-xs")}
          >
            {Icon ? <Icon className="h-[14px] w-[14px]" /> : null}
            <span>{label}</span>
            {badge}
          </button>
        );
      })}
    </div>
  );
}
