"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Bot,
  Zap,
  RefreshCw,
  Pause,
  Play,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { DataTable, Column } from "@/app/components/admin/DataTable";
import { StatusCard } from "@/app/components/ui/StatusCard";
import { Button } from "@/app/components/ui/Button";
import { useAuthFetch } from "@/app/hooks/useAuthFetch";
import { formatDateTime, formatNumber, truncate } from "@/lib/utils";

interface AILogRow {
  id: string;
  userId: string;
  prompt: string;
  response: string;
  tokensUsed: number;
  endpoint: string;
  createdAt: string;
  user: { email: string };
}

interface LogsResponse {
  logs: AILogRow[];
  stats: { totalRequests: number; totalTokens: number };
}

const POLL_INTERVAL_MS = 10_000;

export default function AIMonitorPage() {
  const authFetch = useAuthFetch();
  const [logs, setLogs] = useState<AILogRow[]>([]);
  const [stats, setStats] = useState({ totalRequests: 0, totalTokens: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLogs = useCallback(async () => {
    setError(null);
    try {
      const data = await authFetch<LogsResponse>("/api/admin/ai-logs?limit=50");
      setLogs(data.logs);
      setStats(data.stats);
      setLastRefreshed(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch logs");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (!isPolling) {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => void fetchLogs(), POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPolling, fetchLogs]);

  const columns: Column<AILogRow>[] = [
    {
      key: "user",
      header: "User",
      width: "180px",
      render: (log) => (
        <span className="text-xs font-medium text-gray-700">{log.user.email}</span>
      ),
    },
    {
      key: "prompt",
      header: "Prompt",
      render: (log) => (
        <div className="space-y-1">
          <p className="text-xs text-gray-700">{truncate(log.prompt, 120)}</p>
          {expandedId === log.id && (
            <div className="rounded-md bg-gray-50 p-2 text-xs text-gray-500">
              <p className="font-semibold text-gray-600 mb-1">Response:</p>
              <p className="whitespace-pre-wrap">{truncate(log.response, 400)}</p>
            </div>
          )}
        </div>
      ),
    },
    {
      key: "tokens",
      header: "Tokens",
      width: "80px",
      align: "right",
      render: (log) => (
        <span className="text-xs font-mono text-teal-600">
          {formatNumber(log.tokensUsed)}
        </span>
      ),
    },
    {
      key: "endpoint",
      header: "Endpoint",
      width: "120px",
      render: (log) => (
        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
          {log.endpoint}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "Time",
      width: "130px",
      render: (log) => (
        <span className="text-xs text-gray-400">{formatDateTime(log.createdAt)}</span>
      ),
    },
    {
      key: "expand",
      header: "",
      width: "40px",
      align: "center",
      render: (log) => (
        <button
          onClick={() => setExpandedId((id) => (id === log.id ? null : log.id))}
          className="rounded p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label={expandedId === log.id ? "Collapse" : "Expand"}
        >
          {expandedId === log.id ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">AI Monitor</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Live prompt audit stream — refreshes every {POLL_INTERVAL_MS / 1000}s
            {lastRefreshed && (
              <span className="ml-2 text-gray-400">
                · Last updated {formatDateTime(lastRefreshed)}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void fetchLogs()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button
            variant={isPolling ? "danger" : "primary"}
            size="sm"
            onClick={() => setIsPolling((p) => !p)}
          >
            {isPolling ? (
              <>
                <Pause className="h-3.5 w-3.5" />
                Pause
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                Resume
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
        <StatusCard
          title="Total AI Requests"
          value={formatNumber(stats.totalRequests)}
          icon={Bot}
          iconClassName="bg-amber-50 text-amber-600"
          trend="up"
          trendValue="All time"
        />
        <StatusCard
          title="Total Tokens Consumed"
          value={formatNumber(stats.totalTokens)}
          icon={Zap}
          iconClassName="bg-teal-50 text-teal-600"
          trend="up"
          trendValue="Cumulative"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${
            isPolling ? "bg-emerald-500 animate-pulse" : "bg-gray-400"
          }`}
        />
        <span className="text-xs text-gray-500">
          {isPolling ? "Live" : "Paused"} · Showing latest {logs.length} entries
        </span>
      </div>

      <DataTable
        columns={columns}
        data={logs}
        loading={loading}
        error={null}
        keyExtractor={(log) => log.id}
        emptyMessage="No AI requests have been logged yet."
      />
    </div>
  );
}
