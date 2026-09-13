import { create } from "zustand";
import type { AuthUser } from "@tratable/shared";

/**
 * The access token lives in memory only (never localStorage — an XSS that
 * can read localStorage can also just call the API directly, but keeping
 * the token out of persistent storage limits its lifetime to the tab).
 * The refresh token is an httpOnly cookie the browser sends automatically;
 * this store never sees it.
 */
interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  status: "loading" | "authenticated" | "anonymous";
  setSession: (user: AuthUser, accessToken: string) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  status: "loading",
  setSession: (user, accessToken) => set({ user, accessToken, status: "authenticated" }),
  clearSession: () => set({ user: null, accessToken: null, status: "anonymous" }),
}));
