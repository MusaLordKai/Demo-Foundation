import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { apiPost, setToken, getToken } from "../api/client";
import type { User } from "../api/types";

interface LoginResponse {
  token: string;
  user: User;
}

interface AuthState {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const STORAGE_KEY = "case-processor-user";
const AuthContext = createContext<AuthState | null>(null);

function loadUser(): User | null {
  // Only trust a cached user if a token is also present.
  if (!getToken()) return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as User) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(loadUser);

  const value = useMemo<AuthState>(
    () => ({
      user,
      async login(email, password) {
        const res = await apiPost<LoginResponse>("/auth/login", { email, password });
        setToken(res.token);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(res.user));
        setUser(res.user);
      },
      logout() {
        setToken(null);
        localStorage.removeItem(STORAGE_KEY);
        setUser(null);
      },
    }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
