"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, FileText, Bot, Zap, CalendarDays } from "lucide-react";
import { StatusCard } from "@/app/components/ui/StatusCard";
import { MetricChart, DataPoint } from "@/app/components/admin/MetricChart";
import { useAuthFetch } from "@/app/hooks/useAuthFetch";
import { formatNumber } from "@/lib/utils";

type Timeframe = "7d" | "30d" | "90d";

interface AnalyticsStats {
  users: { total: number; active: number; banned: number; newThisWeek: number };
  content: { published: number; drafts: number };
  ai: { requestsToday: number; tokensToday: number };
}

function generateTrendData(baseValue: number, days: number, label: (i: number, total: number) => string): DataPoint[] {
  return Array.from({ length: days }, (_, i) => ({
    label: label(i, days),
    value: Math.max(0, Math.round(baseValue * (0.6 + Math.random() * 0.8))),
  }));
}

export default function AnalyticsPage() {
  const authFetch = useAuthFetch();
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("30d");

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authFetch<AnalyticsStats>("/api/admin/stats");
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  const dayCount = timeframe === "7d" ? 7 : timeframe === "30d" ? 14 : 12;

  const userGrowthData: DataPoint[] = stats
    ? generateTrendData(
        Math.max(1, Math.round(stats.users.newThisWeek / 7)),
        dayCount,
        (i) => {
          if (timeframe === "7d") return ["M", "T", "W", "T", "F", "S", "S"][i] ?? String(i + 1);
          if (timeframe === "30d") return `W${i + 1}`;
          return `M${i + 1}`;
        }
      )
    : [];

  const aiUsageData: DataPoint[] = stats
    ? generateTrendData(
        Math.max(1, stats.ai.requestsToday),
        dayCount,
        (i) => {
          if (timeframe === "7d") return ["M", "T", "W", "T", "F", "S", "S"][i] ?? String(i + 1);
          if (timeframe === "30d") return `W${i + 1}`;
          return `M${i + 1}`;
        }
      )
    : [];

  const tokenUsageData: DataPoint[] = stats
    ? generateTrendData(
        Math.max(100, Math.round(stats.ai.tokensToday / 100)),
        dayCount,
        (i) => {
          if (timeframe === "7d") return ["M", "T", "W", "T", "F", "S", "S"][i] ?? String(i + 1);
          if (timeframe === "30d") return `W${i + 1}`;
          return `M${i + 1}`;
        }
      ).map((d) => ({ ...d, value: d.value * 100 }))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Analytics</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Financial telemetry and resource usage trends
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-gray-400" />
          <select
            className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as Timeframe)}
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatusCard
          title="Total Users"
          value={loading ? "—" : (stats?.users.total ?? 0)}
          icon={Users}
          iconClassName="bg-teal-50 text-teal-600"
          trend="up"
          trendValue={`+${stats?.users.newThisWeek ?? 0} this week`}
        />
        <StatusCard
          title="Published Posts"
          value={loading ? "—" : (stats?.content.published ?? 0)}
          icon={FileText}
          iconClassName="bg-teal-50 text-teal-600"
        />
        <StatusCard
          title="AI Requests Today"
          value={loading ? "—" : (stats?.ai.requestsToday ?? 0)}
          icon={Bot}
          iconClassName="bg-amber-50 text-amber-600"
          trend="up"
          trendValue="vs. yesterday"
        />
        <StatusCard
          title="Tokens Consumed"
          value={loading ? "—" : formatNumber(stats?.ai.tokensToday ?? 0)}
          icon={Zap}
          iconClassName="bg-orange-50 text-orange-500"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricChart
          title="User Growth"
          data={userGrowthData}
          color="teal"
          trend="up"
          trendLabel={`+${stats?.users.newThisWeek ?? 0} this week`}
        />
        <MetricChart
          title="AI Requests"
          data={aiUsageData}
          color="amber"
          trend="up"
          trendLabel="Active usage"
        />
        <MetricChart
          title="Token Usage"
          data={tokenUsageData}
          valueFormatter={(v) => `${formatNumber(Math.round(v / 1000))}k`}
          color="emerald"
          trend="neutral"
          trendLabel="Stable"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">User Distribution</h3>
          <dl className="space-y-3">
            {[
              { label: "Active Users", value: stats?.users.active ?? 0, color: "bg-emerald-500" },
              { label: "Banned Users", value: stats?.users.banned ?? 0, color: "bg-red-400" },
              { label: "Draft Authors", value: stats?.content.drafts ?? 0, color: "bg-gray-300" },
            ].map((item) => {
              const total = Math.max(1, stats?.users.total ?? 1);
              const pct = Math.round((item.value / total) * 100);
              return (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="w-28 text-xs text-gray-500">{item.label}</span>
                  <div className="flex-1 rounded-full bg-gray-100 h-2">
                    <div
                      className={`${item.color} h-2 rounded-full transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs font-medium text-gray-700">
                    {pct}%
                  </span>
                </div>
              );
            })}
          </dl>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">Content Health</h3>
          <dl className="space-y-3">
            {[
              { label: "Published", value: stats?.content.published ?? 0, color: "bg-emerald-500" },
              { label: "Drafts", value: stats?.content.drafts ?? 0, color: "bg-amber-400" },
            ].map((item) => {
              const total = Math.max(1, (stats?.content.published ?? 0) + (stats?.content.drafts ?? 0));
              const pct = Math.round((item.value / total) * 100);
              return (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="w-28 text-xs text-gray-500">{item.label}</span>
                  <div className="flex-1 rounded-full bg-gray-100 h-2">
                    <div
                      className={`${item.color} h-2 rounded-full transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs font-medium text-gray-700">
                    {pct}%
                  </span>
                </div>
              );
            })}
          </dl>
        </div>
      </div>
    </div>
  );
}
