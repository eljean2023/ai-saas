"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Cpu, Send, Zap, LogOut, Bot, User } from "lucide-react";
import { useAuth } from "@/app/contexts/AuthContext";
import { useAuthFetch } from "@/app/hooks/useAuthFetch";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

interface UserStats {
  tokensUsed: number;
  requestCount: number;
  quota: number;
}

const STARTERS = [
  "Optimize a PostgreSQL index for a 50M-row users table",
  "Generate a RAG pipeline with Mastra and Pinecone",
  "Design RBAC middleware for Next.js App Router",
];

export default function UserDashboardPage() {
  const { user, accessToken, logout } = useAuth();
  const authFetch = useAuthFetch();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [stats, setStats] = useState<UserStats>({ tokensUsed: 0, requestCount: 0, quota: 10_000 });
  const [statsLoading, setStatsLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchStats = useCallback(async () => {
    try {
      const data = await authFetch<UserStats>("/api/user/stats");
      setStats(data);
    } catch {
      // non-critical, keep defaults
    } finally {
      setStatsLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (prompt?: string) => {
    const text = (prompt ?? input).trim();
    if (!text || isStreaming || !accessToken) return;

    setInput("");
    setIsStreaming(true);

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text };
    const assistantId = crypto.randomUUID();
    const assistantMsg: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      streaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ prompt: text }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({ error: "AI request failed" })) as { error?: string };
        throw new Error(body.error ?? "AI request failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let sessionTokens = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6);
          if (raw === "[DONE]") break;

          try {
            const chunk = JSON.parse(raw) as {
              type: string;
              content?: string;
              tokensUsed?: number;
            };

            if (chunk.type === "text" && chunk.content) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + chunk.content }
                    : m
                )
              );
            }

            if (chunk.type === "usage" && chunk.tokensUsed) {
              sessionTokens = chunk.tokensUsed;
              setStats((prev) => ({
                ...prev,
                tokensUsed: prev.tokensUsed + sessionTokens,
                requestCount: prev.requestCount + 1,
              }));
            }
          } catch {
            // malformed SSE chunk
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: "Error: could not reach AI service. Please try again.", streaming: false }
              : m
          )
        );
      }
    } finally {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m))
      );
      setIsStreaming(false);
      textareaRef.current?.focus();
    }
  };

  const pct = Math.min(100, Math.round((stats.tokensUsed / stats.quota) * 100));
  const barColor =
    pct > 80 ? "bg-red-500" : pct > 60 ? "bg-amber-500" : "bg-emerald-500";
  const remainingColor = pct > 80 ? "text-red-400" : "text-emerald-400";

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-white">
      {/* Top bar */}
      <header className="flex shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900/80 px-6 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-emerald-400" />
          <span className="text-sm font-bold tracking-tight">
            AI<span className="text-emerald-400">SaaS</span>
          </span>
          <span className="ml-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
            Workspace
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-400">{user?.email}</span>
          <button
            onClick={() => void logout()}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:border-slate-600 hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        {/* Chat panel */}
        <div className="flex min-w-0 flex-1 flex-col border-r border-slate-800">
          {/* Messages */}
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                  <Bot className="h-8 w-8 text-emerald-400" />
                </div>
                <div>
                  <p className="font-semibold text-slate-200">AI Assistant Ready</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Ask anything — architecture decisions to production code generation.
                  </p>
                </div>
                <div className="w-full max-w-sm space-y-2">
                  {STARTERS.map((s) => (
                    <button
                      key={s}
                      onClick={() => void sendMessage(s)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-left text-xs text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-200"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="shrink-0 rounded-full border border-emerald-500/20 bg-emerald-500/10 p-1.5">
                    <Bot className="h-4 w-4 text-emerald-400" />
                  </div>
                )}

                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "rounded-br-sm bg-emerald-600 text-white"
                      : "rounded-bl-sm border border-slate-700 bg-slate-800 text-slate-200"
                  }`}
                >
                  {msg.content || (msg.streaming && (
                    <span className="flex gap-1 py-0.5">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
                    </span>
                  ))}
                  {msg.streaming && msg.content && (
                    <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-emerald-400" />
                  )}
                </div>

                {msg.role === "user" && (
                  <div className="shrink-0 rounded-full border border-slate-700 bg-slate-800 p-1.5">
                    <User className="h-4 w-4 text-slate-400" />
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <div className="shrink-0 border-t border-slate-800 p-4">
            <div className="flex items-end gap-3">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendMessage();
                  }
                }}
                disabled={isStreaming}
                rows={1}
                placeholder="Message the AI assistant… (Enter to send, Shift+Enter for newline)"
                className="max-h-40 flex-1 resize-none rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder-slate-500 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 disabled:opacity-50"
              />
              <button
                onClick={() => void sendMessage()}
                disabled={!input.trim() || isStreaming}
                className="shrink-0 rounded-xl bg-emerald-600 p-3 text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isStreaming ? (
                  <span className="block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="w-72 shrink-0 space-y-5 overflow-y-auto bg-slate-900/40 p-5">
          {/* Token meter */}
          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Token Usage
            </h2>
            <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Zap className="h-4 w-4 text-amber-400" />
                  <span className="text-xs font-medium text-slate-300">Consumption</span>
                </div>
                {statsLoading ? (
                  <span className="h-3 w-10 animate-pulse rounded bg-slate-800" />
                ) : (
                  <span className="font-mono text-xs text-slate-400">{pct}%</span>
                )}
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                {!statsLoading && (
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                    style={{ width: `${pct}%` }}
                  />
                )}
              </div>

              {!statsLoading && (
                <p className="text-right font-mono text-xs text-slate-500">
                  {stats.tokensUsed.toLocaleString()} / {stats.quota.toLocaleString()} tokens
                </p>
              )}
            </div>
          </div>

          {/* Session stats */}
          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Session Stats
            </h2>
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
                <span className="text-xs text-slate-400">AI Requests</span>
                <span className="font-mono text-sm font-semibold text-white">
                  {statsLoading ? "—" : stats.requestCount}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
                <span className="text-xs text-slate-400">Tokens Remaining</span>
                <span className={`font-mono text-sm font-semibold ${remainingColor}`}>
                  {statsLoading
                    ? "—"
                    : (stats.quota - stats.tokensUsed).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Account */}
          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Account
            </h2>
            <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Role</span>
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
                  USER
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Status</span>
                <span className="flex items-center gap-1 text-xs text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Active
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Plan</span>
                <span className="text-xs text-slate-300">Starter</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
