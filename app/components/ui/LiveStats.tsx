"use client";

import { useEffect, useState } from "react";

type Stat = {
  label: string;
  target: number;
  format: (v: number) => string;
};

const STATS: Stat[] = [
  { label: "Uptime", target: 99.9, format: (v) => `${v.toFixed(1)}%` },
  { label: "AI Requests", target: 45, format: (v) => `${Math.round(v)}k+` },
  { label: "Avg Latency", target: 12, format: (v) => `${Math.round(v)}ms` },
  { label: "Role Tiers", target: 3, format: (v) => `${Math.round(v)}` },
];

const DURATION = 1800;

export default function LiveStats() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const start = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const raw = Math.min((now - start) / DURATION, 1);
      setProgress(1 - Math.pow(1 - raw, 3));
      if (raw < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {STATS.map(({ label, target, format }) => (
        <div
          key={label}
          className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-center"
        >
          <p className="text-xl font-bold tabular-nums text-emerald-400">
            {format(target * progress)}
          </p>
          <p className="mt-0.5 text-xs uppercase tracking-wide text-slate-500">
            {label}
          </p>
        </div>
      ))}
    </div>
  );
}
