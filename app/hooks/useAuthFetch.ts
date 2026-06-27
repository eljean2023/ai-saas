"use client";

import { useCallback } from "react";
import { useAuth } from "@/app/contexts/AuthContext";

export function useAuthFetch() {
  const { accessToken } = useAuth();

  return useCallback(
    async function authFetch<T>(url: string, init?: RequestInit): Promise<T> {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
      }

      const mergedInit: RequestInit = {
        ...init,
        headers: { ...headers, ...init?.headers },
      };

      const res = await fetch(url, mergedInit);

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Request failed" })) as {
          error?: string;
        };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      return res.json() as Promise<T>;
    },
    [accessToken]
  );
}
