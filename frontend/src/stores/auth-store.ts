import { create } from "zustand";
import { persist } from "zustand/middleware";
import { apiFetch } from "../lib/api";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  preferred_language: string;
  preferred_theme: string;
  ai_preferences: Record<string, unknown>;
  favorite_project_ids: string[];
}

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  user: UserProfile | null;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      isAuthenticated: false,
      user: null,

      login: async (email, password, rememberMe = false) => {
        const { access_token } = await apiFetch<{ access_token: string; expires_in: number }>(
          "/api/auth/login",
          {
            method: "POST",
            body: JSON.stringify({ email, password, remember_me: rememberMe }),
          },
        );
        set({ token: access_token, isAuthenticated: true });
        await get().fetchMe();
      },

      logout: () => set({ token: null, isAuthenticated: false, user: null }),

      fetchMe: async () => {
        const user = await apiFetch<UserProfile>("/api/auth/me");
        set({ user });
      },
    }),
    { name: "shadow-po-auth" },
  ),
);
