import { X } from "lucide-react";
import {
  useThemeStore,
  type AccentVariant,
  type DashboardVariant,
  type DensityMode,
  type KanbanVariant,
  type ThemeMode,
} from "../../stores/theme-store";
import { useUiStore } from "../../stores/ui-store";
import { cn } from "../../lib/utils";

function SegmentedRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="eyebrow">{label}</span>
      <div className="flex overflow-hidden rounded-lg border border-[var(--border)]">
        {options.map((option, index) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 bg-[var(--bg-panel-3)] px-2.5 py-1.5 text-[11.5px] text-[var(--text)] transition",
              value === option.value && "bg-[var(--text-strong)] text-[var(--bg-body)]",
              index > 0 && "border-l border-[var(--border)]",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function DesignTweaksPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const mode = useThemeStore((state) => state.mode);
  const accentVariant = useThemeStore((state) => state.accentVariant);
  const densityMode = useThemeStore((state) => state.densityMode);
  const dashboardVariant = useThemeStore((state) => state.dashboardVariant);
  const kanbanVariant = useThemeStore((state) => state.kanbanVariant);
  const setMode = useThemeStore((state) => state.setMode);
  const setAccentVariant = useThemeStore((state) => state.setAccentVariant);
  const setDensityMode = useThemeStore((state) => state.setDensityMode);
  const setDashboardVariant = useThemeStore((state) => state.setDashboardVariant);
  const setKanbanVariant = useThemeStore((state) => state.setKanbanVariant);
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const setSidebarCollapsed = useUiStore((state) => state.setSidebarCollapsed);

  if (!open) return null;

  return (
    <aside className="fixed bottom-4 right-4 z-40 w-[260px] rounded-[14px] border border-[var(--border)] bg-[var(--bg-panel-3)] p-3.5 shadow-[0_20px_50px_rgba(15,21,17,0.12)]">
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Tweaks · variations
        </h4>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--bg-panel-2)] hover:text-[var(--text-strong)]"
          aria-label="Fermer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        <SegmentedRow<DashboardVariant>
          label="Dashboard"
          value={dashboardVariant}
          onChange={setDashboardVariant}
          options={[
            { value: "a", label: "A · Ledger" },
            { value: "b", label: "B · Cartes" },
          ]}
        />

        <SegmentedRow<KanbanVariant>
          label="Kanban"
          value={kanbanVariant}
          onChange={setKanbanVariant}
          options={[
            { value: "a", label: "A · Ruling" },
            { value: "b", label: "B · Zones" },
          ]}
        />

        <SegmentedRow<DensityMode>
          label="Densite"
          value={densityMode}
          onChange={setDensityMode}
          options={[
            { value: "comfy", label: "Aeree" },
            { value: "dense", label: "Dense" },
          ]}
        />

        <SegmentedRow<"full" | "rail">
          label="Sidebar"
          value={sidebarCollapsed ? "rail" : "full"}
          onChange={(value) => setSidebarCollapsed(value === "rail")}
          options={[
            { value: "full", label: "Complete" },
            { value: "rail", label: "Rail" },
          ]}
        />

        <SegmentedRow<ThemeMode>
          label="Theme"
          value={mode}
          onChange={setMode}
          options={[
            { value: "light", label: "Clair" },
            { value: "dark", label: "Sombre" },
          ]}
        />

        <SegmentedRow<AccentVariant>
          label="Accent signature"
          value={accentVariant}
          onChange={setAccentVariant}
          options={[
            { value: "orange", label: "Orange" },
            { value: "blue", label: "Bleu" },
            { value: "violet", label: "Violet" },
            { value: "magenta", label: "Magenta" },
          ]}
        />
      </div>
    </aside>
  );
}
