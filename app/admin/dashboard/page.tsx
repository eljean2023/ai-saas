"use client";

import { useEffect, useState } from "react";
import {
  Users,
  UserCheck,
  UserX,
  UserPlus,
  FileText,
  Bot,
  Zap,
  RefreshCw,
} from "lucide-react";
import { StatusCard } from "@/app/components/ui/StatusCard";
import { Button } from "@/app/components/ui/Button";
import { MetricChart, DataPoint } from "@/app/components/admin/MetricChart";
import { useAuthFetch } from "@/app/hooks/useAuthFetch";
import { useAuth } from "@/app/contexts/AuthContext";
import { formatNumber } from "@/lib/utils";

interface DashboardStats {
  users: { total: number; active: number; banned: number; newThisWeek: number };
  content: { published: number; drafts: number };
  ai: { requestsToday: number; tokensToday: number };
}

const AI_REQUESTS_CHART: DataPoint[] = [
  { label: "Mon", value: 210 },
  { label: "Tue", value: 295 },
  { label: "Wed", value: 178 },
  { label: "Thu", value: 340 },
  { label: "Fri", value: 420 },
  { label: "Sat", value: 190 },
  { label: "Sun", value: 318 },
];

const NEW_USERS_CHART: DataPoint[] = [
  { label: "Mon", value: 8 },
  { label: "Tue", value: 14 },
  { label: "Wed", value: 6 },
  { label: "Thu", value: 19 },
  { label: "Fri", value: 11 },
  { label: "Sat", value: 4 },
  { label: "Sun", value: 7 },
];

const TOKENS_CHART: DataPoint[] = [
  { label: "Mon", value: 620000 },
  { label: "Tue", value: 810000 },
  { label: "Wed", value: 490000 },
  { label: "Thu", value: 975000 },
  { label: "Fri", value: 1200000 },
  { label: "Sat", value: 540000 },
  { label: "Sun", value: 924500 },
];

export default function DashboardPage() {
  const authFetch = useAuthFetch();
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isReadOnly = user?.role === "USER";

  const fetchStats = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await authFetch<DashboardStats>("/api/admin/stats");
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stats");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Platform overview and key metrics
            {isReadOnly && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                Read-only
              </span>
            )}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          loading={refreshing}
          onClick={() => void fetchStats(true)}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Users
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatusCard
            title="Total Users"
            value={loading ? "—" : (stats?.users.total ?? 0)}
            icon={Users}
            iconClassName="bg-teal-50 text-teal-600"
          />
          <StatusCard
            title="Active"
            value={loading ? "—" : (stats?.users.active ?? 0)}
            icon={UserCheck}
            iconClassName="bg-emerald-50 text-emerald-600"
            trend="up"
            trendValue="Healthy"
          />
          <StatusCard
            title="Banned"
            value={loading ? "—" : (stats?.users.banned ?? 0)}
            icon={UserX}
            iconClassName="bg-red-50 text-red-500"
          />
          <StatusCard
            title="New This Week"
            value={loading ? "—" : (stats?.users.newThisWeek ?? 0)}
            icon={UserPlus}
            iconClassName="bg-sky-50 text-sky-600"
            trend="up"
            trendValue="vs last week"
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Content &amp; AI
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatusCard
            title="Published Posts"
            value={loading ? "—" : (stats?.content.published ?? 0)}
            icon={FileText}
            iconClassName="bg-violet-50 text-violet-600"
          />
          <StatusCard
            title="Drafts"
            value={loading ? "—" : (stats?.content.drafts ?? 0)}
            icon={FileText}
            iconClassName="bg-gray-100 text-gray-500"
          />
          <StatusCard
            title="AI Requests Today"
            value={loading ? "—" : (stats?.ai.requestsToday ?? 0)}
            icon={Bot}
            iconClassName="bg-amber-50 text-amber-600"
          />
          <StatusCard
            title="Tokens Today"
            value={loading ? "—" : formatNumber(stats?.ai.tokensToday ?? 0)}
            icon={Zap}
            iconClassName="bg-orange-50 text-orange-500"
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Weekly Trends
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricChart
            title="AI Requests (last 7 days)"
            data={AI_REQUESTS_CHART}
            trend="up"
            trendLabel="+12% vs prior week"
            color="amber"
          />
          <MetricChart
            title="New Users (last 7 days)"
            data={NEW_USERS_CHART}
            trend="neutral"
            trendLabel="Stable"
            color="teal"
          />
          <MetricChart
            title="Tokens Used (last 7 days)"
            data={TOKENS_CHART}
            valueFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            trend="up"
            trendLabel="+24% vs prior week"
            color="emerald"
          />
        </div>
      </section>
    </div>
  );
}
