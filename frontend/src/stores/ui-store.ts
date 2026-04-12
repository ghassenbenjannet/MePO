import { create } from "zustand";

interface UiState {
  aiDockOpen: boolean;
  setAiDockOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  aiDockOpen: true,
  setAiDockOpen: (open) => set({ aiDockOpen: open }),
}));
