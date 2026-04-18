import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark";
export type AccentVariant = "orange" | "blue" | "violet" | "magenta";
export type DensityMode = "comfy" | "dense";
export type DashboardVariant = "a" | "b";
export type KanbanVariant = "a" | "b";

interface ThemeState {
  mode: ThemeMode;
  accentVariant: AccentVariant;
  densityMode: DensityMode;
  dashboardVariant: DashboardVariant;
  kanbanVariant: KanbanVariant;
  lastVisitedPath: string;
  toggleMode: () => void;
  setMode: (mode: ThemeMode) => void;
  setAccentVariant: (accentVariant: AccentVariant) => void;
  setDensityMode: (densityMode: DensityMode) => void;
  setDashboardVariant: (dashboardVariant: DashboardVariant) => void;
  setKanbanVariant: (kanbanVariant: KanbanVariant) => void;
  setLastVisitedPath: (lastVisitedPath: string) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: "light" as ThemeMode,
      accentVariant: "orange" as AccentVariant,
      densityMode: "comfy" as DensityMode,
      dashboardVariant: "a" as DashboardVariant,
      kanbanVariant: "a" as KanbanVariant,
      lastVisitedPath: "/",
      toggleMode: () =>
        set((state) => ({ mode: state.mode === "light" ? "dark" : "light" })),
      setMode: (mode) => set({ mode }),
      setAccentVariant: (accentVariant) => set({ accentVariant }),
      setDensityMode: (densityMode) => set({ densityMode }),
      setDashboardVariant: (dashboardVariant) => set({ dashboardVariant }),
      setKanbanVariant: (kanbanVariant) => set({ kanbanVariant }),
      setLastVisitedPath: (lastVisitedPath) => set({ lastVisitedPath }),
    }),
    { name: "shadow-po-theme-v3" },
  ),
);
