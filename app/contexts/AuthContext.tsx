"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";

type UserRole = "USER" | "ADMIN" | "SUPER_ADMIN";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface LoginResponse {
  user: { id: string; email: string; role: UserRole };
  accessToken: string;
}

interface RefreshResponse {
  accessToken: string;
}

function parseJwtPayload(
  token: string
): { sub: string; email: string; role: UserRole } | null {
  try {
    const [, payload] = token.split(".");
    const decoded = JSON.parse(atob(payload)) as {
      sub: string;
      email: string;
      role: UserRole;
    };
    return decoded;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/auth/refresh", { method: "POST" });
      if (!res.ok) return false;

      const data = (await res.json()) as RefreshResponse;
      const payload = parseJwtPayload(data.accessToken);
      if (!payload) return false;

      setAccessToken(data.accessToken);
      setUser({ id: payload.sub, email: payload.email, role: payload.role });
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    const storedToken =
      typeof window !== "undefined"
        ? sessionStorage.getItem("access_token")
        : null;

    if (storedToken) {
      const payload = parseJwtPayload(storedToken);
      if (payload) {
        sessionStorage.removeItem("access_token");
        setAccessToken(storedToken);
        setUser({ id: payload.sub, email: payload.email, role: payload.role });
        setIsLoading(false);
        return;
      }
    }

    refresh().finally(() => setIsLoading(false));
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error: string };
        throw new Error(body.error);
      }

      const data = (await res.json()) as LoginResponse;
      setAccessToken(data.accessToken);
      setUser({ id: data.user.id, email: data.user.email, role: data.user.role });
    },
    []
  );

  const logout = useCallback(async (): Promise<void> => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setUser(null);
    setAccessToken(null);
  }, []);

  const value: AuthContextValue = {
    user,
    accessToken,
    isLoading,
    isAuthenticated: user !== null,
    isAdmin: user?.role === "ADMIN" || user?.role === "SUPER_ADMIN",
    isSuperAdmin: user?.role === "SUPER_ADMIN",
    login,
    logout,
    refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
