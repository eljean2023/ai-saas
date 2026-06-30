import Link from "next/link";
import { Cpu, Zap, Shield, BarChart3, ArrowRight, CheckCircle } from "lucide-react";
import LiveStats from "@/app/components/ui/LiveStats";

const FEATURES = [
  {
    icon: Zap,
    title: "Streaming AI Engine",
    desc: "Real-time SSE streaming with the OrchestratorAgent, RAG context injection, and per-user token metering baked in.",
    accent: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    glow: "hover:border-amber-500/50 hover:shadow-amber-900/30",
  },
  {
    icon: Shield,
    title: "RBAC Authentication",
    desc: "JWT + refresh token rotation with three role tiers (USER, ADMIN, SUPER_ADMIN) enforced at both middleware and API layers.",
    accent: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    glow: "hover:border-emerald-500/50 hover:shadow-emerald-900/30",
  },
  {
    icon: BarChart3,
    title: "Admin Operations Panel",
    desc: "Full telemetry dashboard — live user management, content CMS, AI request audit stream, and analytics trends.",
    accent: "text-sky-400 bg-sky-400/10 border-sky-400/20",
    glow: "hover:border-sky-500/50 hover:shadow-sky-900/30",
  },
] as const;

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Sticky nav */}
      <header className="sticky top-0 z-50 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Cpu className="h-6 w-6 text-emerald-400" />
            <span className="text-lg font-bold tracking-tight">
              AI<span className="text-emerald-400">SaaS</span>
            </span>
          </div>
          <Link
            href="/login"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
          >
            Sign In
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-24 text-center">
        <div className="animate-fade-in-up mb-8 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-medium text-emerald-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          Production-Ready SaaS Infrastructure
        </div>

        <h1
          className="animate-fade-in-up mb-6 text-5xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl"
          style={{ animationDelay: "150ms" }}
        >
          Build AI Products{" "}
          <span className="text-emerald-400">10x Faster</span>
        </h1>

        <p
          className="animate-fade-in-up mx-auto mb-10 max-w-2xl text-lg text-slate-400"
          style={{ animationDelay: "300ms" }}
        >
          Production-grade SaaS boilerplate with real-time streaming AI, JWT RBAC
          authentication, and a full admin operations panel — ready to ship today.
        </p>

        <div
          className="animate-fade-in-up flex items-center justify-center gap-4"
          style={{ animationDelay: "450ms" }}
        >
          <Link
            href="/login"
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white shadow-lg shadow-emerald-900/40 transition-all duration-200 hover:scale-[1.03] hover:bg-emerald-500 hover:shadow-emerald-700/40"
          >
            Get Started Free
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-slate-700 bg-slate-900 px-6 py-3 font-semibold text-slate-300 transition-all duration-200 hover:scale-[1.03] hover:border-slate-500 hover:text-white"
          >
            View Demo
          </Link>
        </div>

        <p
          className="animate-fade-in-up mt-5 text-xs text-slate-600"
          style={{ animationDelay: "550ms" }}
        >
          Demo: admin@test.com / Admin1234! &nbsp;·&nbsp; user@test.com / User1234!
        </p>

        <div
          className="animate-fade-in-up"
          style={{ animationDelay: "650ms" }}
        >
          <LiveStats />
        </div>
      </section>

      {/* Feature cards */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc, accent, glow }, index) => (
            <div
              key={title}
              style={{ animationDelay: `${800 + index * 120}ms` }}
              className={`animate-fade-in-up cursor-default rounded-2xl border border-slate-800 bg-slate-900/60 p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg ${glow}`}
            >
              <div className={`mb-4 inline-flex rounded-xl border p-2.5 ${accent}`}>
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-base font-semibold text-white">{title}</h3>
              <p className="text-sm leading-relaxed text-slate-400">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-t border-slate-800 bg-slate-900/40">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-6 py-14 sm:grid-cols-4">
          {[
            "PostgreSQL + Prisma ORM",
            "HttpOnly cookie sessions",
            "Soft delete & audit trails",
            "Neon serverless database",
          ].map((item) => (
            <div key={item} className="flex items-center gap-3">
              <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
              <span className="text-sm text-slate-300">{item}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-emerald-400" />
            <span className="text-sm text-slate-500">AI SaaS Platform</span>
          </div>
          <p className="text-xs text-slate-600">© 2026 All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
