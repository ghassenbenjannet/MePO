import { create } from "zustand";
import { persist } from "zustand/middleware";

type ThemeMode = "light" | "dark";

interface ThemeState {
  mode: ThemeMode;
  toggleMode: () => void;
  setMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: "light" as ThemeMode,
      toggleMode: () =>
        set((state) => ({ mode: state.mode === "light" ? "dark" : "light" })),
      setMode: (mode) => set({ mode }),
    }),
    { name: "shadow-po-theme-v2" },
  ),
);
