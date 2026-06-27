"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Cpu, LogIn } from "lucide-react";

interface LoginResponse {
  accessToken: string;
  user: { id: string; email: string; role: "USER" | "ADMIN" | "SUPER_ADMIN" };
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error: string };
        throw new Error(body.error ?? "Login failed");
      }

      const data = (await res.json()) as LoginResponse;
      // Store token for AuthContext to pick up on next render
      sessionStorage.setItem("access_token", data.accessToken);

      router.push(data.user.role === "USER" ? "/dashboard" : "/admin/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 transition-opacity hover:opacity-80"
          >
            <Cpu className="h-8 w-8 text-emerald-400" />
            <span className="text-xl font-bold tracking-tight text-white">
              AI<span className="text-emerald-400">SaaS</span>
            </span>
          </Link>
          <p className="text-sm text-slate-500">Sign in to your workspace</p>
        </div>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-black/40 backdrop-blur-sm ring-1 ring-emerald-500/5"
        >
          <div className="space-y-5">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-300"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-300"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-red-800 bg-red-900/20 px-3 py-2 text-xs text-red-400">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </div>
        </form>

        <p className="mt-4 text-center text-xs text-slate-600">
          <Link href="/" className="transition-colors hover:text-slate-400">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
