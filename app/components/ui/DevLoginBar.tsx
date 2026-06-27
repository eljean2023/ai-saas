"use client";

import { useState } from "react";

type Role = "USER" | "ADMIN" | "SUPER_ADMIN";

interface DevLoginResponse {
  accessToken: string;
  user: { id: string; email: string; role: Role };
}

const BUTTONS: { label: string; role: Role; className: string }[] = [
  {
    label: "Enter as User",
    role: "USER",
    className: "bg-sky-800 hover:bg-sky-700 border-sky-600",
  },
  {
    label: "Enter as Admin",
    role: "ADMIN",
    className: "bg-violet-800 hover:bg-violet-700 border-violet-600",
  },
  {
    label: "Enter as Super Admin",
    role: "SUPER_ADMIN",
    className: "bg-amber-800 hover:bg-amber-700 border-amber-600",
  },
];

export function DevLoginBar() {
  const [loading, setLoading] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (role: Role) => {
    setLoading(role);
    setError(null);
    try {
      const res = await fetch("/api/dev/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error: string };
        throw new Error(body.error ?? "Dev login failed");
      }

      const data = (await res.json()) as DevLoginResponse;
      // Seed the token so AuthContext picks it up immediately on next page mount
      sessionStorage.setItem("dev_access_token", data.accessToken);
      // Hard redirect so the refresh_token HttpOnly cookie is sent on the next request
      window.location.href = "/admin/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dev login failed");
      setLoading(null);
    }
  };

  return (
    <div className="fixed top-0 inset-x-0 z-[200] h-10 flex items-center justify-between gap-3 border-b border-yellow-500/30 bg-gray-950/95 backdrop-blur-sm px-4">
      <div className="flex items-center gap-2 shrink-0">
        <span className="rounded border border-yellow-500/40 bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-bold font-mono text-yellow-400 uppercase tracking-wider">
          DEV
        </span>
        <span className="hidden sm:block text-[11px] text-yellow-600 font-mono">
          Quick Auth — real Neon DB session
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        {BUTTONS.map(({ label, role, className }) => (
          <button
            key={role}
            disabled={loading !== null}
            onClick={() => void handleLogin(role)}
            className={`rounded border px-2.5 py-1 text-[11px] font-semibold text-white transition-colors disabled:opacity-50 ${className}`}
          >
            {loading === role ? "…" : label}
          </button>
        ))}
      </div>

      {error && (
        <span className="shrink-0 text-[11px] text-red-400 font-mono">{error}</span>
      )}
    </div>
  );
}
