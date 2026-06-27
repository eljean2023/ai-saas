import prisma from "@/lib/prisma";
import { UserRepository } from "@/app/repositories/UserRepository";
import { PostRepository } from "@/app/repositories/PostRepository";
import { AgentContext, AnalyticsData, AnalyticsResult } from "./types";

type QueryKey =
  | "user_counts"
  | "new_users"
  | "banned_users"
  | "post_counts"
  | "ai_usage"
  | "user_list";

const QUERY_PATTERNS: Array<{ pattern: RegExp; key: QueryKey }> = [
  { pattern: /new users|registered recently|sign.?ups?/i, key: "new_users" },
  { pattern: /banned|suspended|restricted accounts?/i, key: "banned_users" },
  { pattern: /post.?count|content.?count|how many posts?|articles?/i, key: "post_counts" },
  { pattern: /ai.?usage|token.?usage|api.?calls?|requests? made/i, key: "ai_usage" },
  { pattern: /user.?list|recent users|latest users|list.?of.?users/i, key: "user_list" },
  { pattern: /user.?count|total.?users|how many users|user.?stats/i, key: "user_counts" },
];

function extractTimeframeSince(prompt: string): Date {
  const now = Date.now();
  if (/today|last 24 hours?/i.test(prompt)) return new Date(now - 86_400_000);
  if (/last week|past 7 days?/i.test(prompt)) return new Date(now - 7 * 86_400_000);
  if (/last month|past 30 days?/i.test(prompt)) return new Date(now - 30 * 86_400_000);
  if (/last year|past 365 days?/i.test(prompt)) return new Date(now - 365 * 86_400_000);
  return new Date(now - 30 * 86_400_000);
}

function assertNeverKey(key: never): never {
  throw new Error(`Unhandled analytics query key: ${String(key)}`);
}

export class AnalyticsAgent {
  async query(context: AgentContext): Promise<AnalyticsResult> {
    const key = this.matchQueryKey(context.prompt);
    const data = await this.executeQuery(key, context.prompt);
    const summary = this.formatSummary(data);
    return { query: context.prompt, data, summary };
  }

  private matchQueryKey(prompt: string): QueryKey {
    for (const { pattern, key } of QUERY_PATTERNS) {
      if (pattern.test(prompt)) return key;
    }
    return "user_counts";
  }

  private async executeQuery(key: QueryKey, prompt: string): Promise<AnalyticsData> {
    const since = extractTimeframeSince(prompt);

    switch (key) {
      case "user_counts": {
        const counts = await UserRepository.countByStatus();
        const newInPeriod = await UserRepository.countNewSince(since);
        return {
          type: "user_counts",
          total: counts.ACTIVE + counts.BANNED,
          active: counts.ACTIVE,
          banned: counts.BANNED,
          newInPeriod,
        };
      }

      case "new_users": {
        const count = await UserRepository.countNewSince(since);
        return {
          type: "user_counts",
          total: count,
          active: count,
          banned: 0,
          newInPeriod: count,
        };
      }

      case "banned_users": {
        const result = await UserRepository.list(
          { status: "BANNED" },
          { page: 1, pageSize: 20 }
        );
        return {
          type: "user_list",
          users: result.data.map((u) => ({
            id: u.id,
            email: u.email,
            role: u.role,
            status: u.status,
            createdAt: u.createdAt,
          })),
        };
      }

      case "post_counts": {
        const counts = await PostRepository.countByStatus();
        return {
          type: "post_counts",
          published: counts.PUBLISHED,
          drafts: counts.DRAFT,
        };
      }

      case "ai_usage": {
        const stats = await prisma.aILog.aggregate({
          where: { createdAt: { gte: since } },
          _sum: { tokensUsed: true },
          _count: { id: true },
        });
        return {
          type: "ai_usage",
          requests: stats._count.id,
          tokens: stats._sum.tokensUsed ?? 0,
        };
      }

      case "user_list": {
        const result = await UserRepository.list(
          { status: "ACTIVE" },
          { page: 1, pageSize: 20 }
        );
        return {
          type: "user_list",
          users: result.data.map((u) => ({
            id: u.id,
            email: u.email,
            role: u.role,
            status: u.status,
            createdAt: u.createdAt,
          })),
        };
      }

      default:
        return assertNeverKey(key);
    }
  }

  private formatSummary(data: AnalyticsData): string {
    switch (data.type) {
      case "user_counts":
        return (
          `The platform has ${data.total} total users: ` +
          `${data.active} active and ${data.banned} banned. ` +
          `${data.newInPeriod} new user(s) registered in the selected period.`
        );

      case "post_counts":
        return (
          `Content overview: ${data.published} published post(s) ` +
          `and ${data.drafts} draft(s).`
        );

      case "ai_usage":
        return (
          `AI usage in the selected period: ${data.requests} request(s) processed, ` +
          `consuming ${data.tokens.toLocaleString()} token(s).`
        );

      case "user_list":
        if (data.users.length === 0) return "No users found matching the criteria.";
        return (
          `Found ${data.users.length} user(s):\n` +
          data.users
            .map((u) => `• ${u.email} — ${u.role} / ${u.status}`)
            .join("\n")
        );
    }
  }
}
