import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiState {
  aiDockOpen: boolean;
  sidebarCollapsed: boolean;
  createProjectModalOpen: boolean;
  setAiDockOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
  setCreateProjectModalOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      aiDockOpen: true,
      sidebarCollapsed: false,
      createProjectModalOpen: false,
      setAiDockOpen: (open) => set({ aiDockOpen: open }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      toggleSidebarCollapsed: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setCreateProjectModalOpen: (open) => set({ createProjectModalOpen: open }),
    }),
    {
      name: "shadow-po-ui-v1",
      partialize: (state) => ({
        aiDockOpen: state.aiDockOpen,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    },
  ),
);
