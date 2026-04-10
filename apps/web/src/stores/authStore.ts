import { create } from "zustand";
import type { AuthUser } from "@log-monitor/shared";

interface AuthState {
  user: AuthUser | null;
  isInitialized: boolean;
  setUser: (user: AuthUser | null) => void;
  setInitialized: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isInitialized: false,
  setUser: (user) => set({ user }),
  setInitialized: () => set({ isInitialized: true }),
}));
