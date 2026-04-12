import { create } from "zustand";

interface UiState {
  aiDockOpen: boolean;
  sidebarCollapsed: boolean;
  createProjectModalOpen: boolean;
  setAiDockOpen: (open: boolean) => void;
  toggleSidebarCollapsed: () => void;
  setCreateProjectModalOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  aiDockOpen: true,
  sidebarCollapsed: false,
  createProjectModalOpen: false,
  setAiDockOpen: (open) => set({ aiDockOpen: open }),
  toggleSidebarCollapsed: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setCreateProjectModalOpen: (open) => set({ createProjectModalOpen: open }),
}));
