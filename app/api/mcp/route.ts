import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { UserRepository } from "@/app/repositories/UserRepository";
import { PostRepository } from "@/app/repositories/PostRepository";

const MCP_PROTOCOL_VERSION = "2024-11-05";

// ─── JSON-RPC envelope ────────────────────────────────────────────────────────

const mcpRequestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number()]),
  method: z.string(),
  params: z.record(z.unknown()).optional(),
});

type MCPId = string | number;

function jsonRpcSuccess(id: MCPId, result: unknown): NextResponse {
  return NextResponse.json({ jsonrpc: "2.0", id, result }, { status: 200 });
}

function jsonRpcError(
  id: MCPId | null,
  code: number,
  message: string
): NextResponse {
  const status = code === -32001 ? 401 : code === -32002 ? 403 : 200;
  return NextResponse.json(
    { jsonrpc: "2.0", id, error: { code, message } },
    { status }
  );
}

// ─── Tool manifest ─────────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "get_user_analytics",
    description:
      "Returns aggregated platform analytics (user counts, AI usage) over a configurable lookback window.",
    inputSchema: {
      type: "object",
      properties: {
        timeframe: {
          type: "string",
          enum: ["7d", "30d", "90d"],
          description: "Lookback window. Defaults to 30d.",
        },
      },
      required: [],
    },
  },
  {
    name: "moderate_user_content",
    description:
      "Applies an admin moderation action to a user account or their published content.",
    inputSchema: {
      type: "object",
      properties: {
        userId: { type: "string", description: "Target user cuid." },
        action: {
          type: "string",
          enum: ["BAN_USER", "UNBAN_USER", "DELETE_CONTENT"],
          description: "Moderation action to apply.",
        },
        reason: {
          type: "string",
          minLength: 10,
          maxLength: 500,
          description: "Audit reason logged with the action.",
        },
      },
      required: ["userId", "action", "reason"],
    },
  },
] as const;

// ─── JWT admin validation ─────────────────────────────────────────────────────

const tokenPayloadSchema = z.object({
  sub: z.string().min(1),
  role: z.enum(["USER", "ADMIN", "SUPER_ADMIN"]),
});

type AuthSuccess = { success: true; userId: string; role: "ADMIN" | "SUPER_ADMIN" };
type AuthFailure = { success: false; code: number; message: string };
type AuthResult = AuthSuccess | AuthFailure;

function validateAdminToken(authHeader: string | null): AuthResult {
  if (!authHeader?.startsWith("Bearer ")) {
    return { success: false, code: -32001, message: "Unauthorized: missing Bearer token" };
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return { success: false, code: -32603, message: "Internal error: auth not configured" };
  }

  try {
    const raw = jwt.verify(authHeader.slice(7), secret);
    const parsed = tokenPayloadSchema.safeParse(raw);

    if (!parsed.success) {
      return { success: false, code: -32001, message: "Unauthorized: invalid token payload" };
    }

    const { sub: userId, role } = parsed.data;

    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return { success: false, code: -32002, message: "Forbidden: admin role required" };
    }

    return { success: true, userId, role };
  } catch {
    return { success: false, code: -32001, message: "Unauthorized: token verification failed" };
  }
}

// ─── Tool: get_user_analytics ─────────────────────────────────────────────────

const getUserAnalyticsArgsSchema = z.object({
  timeframe: z.enum(["7d", "30d", "90d"]).default("30d"),
});

async function callGetUserAnalytics(
  id: MCPId,
  args: Record<string, unknown>
): Promise<NextResponse> {
  const parsed = getUserAnalyticsArgsSchema.safeParse(args);
  if (!parsed.success) {
    return jsonRpcError(id, -32602, `Invalid params: ${parsed.error.message}`);
  }

  const { timeframe } = parsed.data;
  const days = timeframe === "7d" ? 7 : timeframe === "90d" ? 90 : 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [statusCounts, newUsers, postCounts, aiStats] = await Promise.all([
    UserRepository.countByStatus(),
    UserRepository.countNewSince(since),
    PostRepository.countByStatus(),
    prisma.aILog.aggregate({
      where: { createdAt: { gte: since } },
      _sum: { tokensUsed: true },
      _count: { id: true },
    }),
  ]);

  const analytics = {
    timeframe,
    generatedAt: new Date().toISOString(),
    users: {
      total: statusCounts.ACTIVE + statusCounts.BANNED,
      active: statusCounts.ACTIVE,
      banned: statusCounts.BANNED,
      newInPeriod: newUsers,
    },
    content: {
      published: postCounts.PUBLISHED,
      drafts: postCounts.DRAFT,
    },
    ai: {
      requestsInPeriod: aiStats._count.id,
      tokensInPeriod: aiStats._sum.tokensUsed ?? 0,
    },
  };

  return jsonRpcSuccess(id, {
    content: [{ type: "text", text: JSON.stringify(analytics, null, 2) }],
  });
}

// ─── Tool: moderate_user_content ──────────────────────────────────────────────

const moderateUserContentArgsSchema = z.object({
  userId: z.string().min(1),
  action: z.enum(["BAN_USER", "UNBAN_USER", "DELETE_CONTENT"]),
  reason: z.string().min(10).max(500),
});

function assertNever(value: never): never {
  throw new Error(`Unhandled moderation action: ${String(value)}`);
}

async function callModerateUserContent(
  id: MCPId,
  args: Record<string, unknown>
): Promise<NextResponse> {
  const parsed = moderateUserContentArgsSchema.safeParse(args);
  if (!parsed.success) {
    return jsonRpcError(id, -32602, `Invalid params: ${parsed.error.message}`);
  }

  const { userId, action, reason } = parsed.data;

  const user = await UserRepository.findById(userId);
  if (!user) {
    return jsonRpcError(id, -32602, `User not found: ${userId}`);
  }

  let outcome: string;

  switch (action) {
    case "BAN_USER": {
      await UserRepository.setStatus(userId, "BANNED");
      outcome = `User ${userId} (${user.email}) has been banned.`;
      break;
    }
    case "UNBAN_USER": {
      await UserRepository.setStatus(userId, "ACTIVE");
      outcome = `User ${userId} (${user.email}) has been restored to active status.`;
      break;
    }
    case "DELETE_CONTENT": {
      const count = await PostRepository.setStatusByAuthor(userId, "DRAFT");
      outcome = `${count} post(s) by ${user.email} have been unpublished.`;
      break;
    }
    default:
      assertNever(action);
  }

  return jsonRpcSuccess(id, {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          { success: true, userId, action, reason, outcome },
          null,
          2
        ),
      },
    ],
  });
}

// ─── tools/call dispatcher ────────────────────────────────────────────────────

const toolsCallParamsSchema = z.object({
  name: z.string(),
  arguments: z.record(z.unknown()).default({}),
});

async function handleToolCall(
  id: MCPId,
  params: Record<string, unknown> | undefined
): Promise<NextResponse> {
  const parsed = toolsCallParamsSchema.safeParse(params);
  if (!parsed.success) {
    return jsonRpcError(id, -32602, "Invalid tools/call params");
  }

  const { name, arguments: args } = parsed.data;

  switch (name) {
    case "get_user_analytics":
      return callGetUserAnalytics(id, args);
    case "moderate_user_content":
      return callModerateUserContent(id, args);
    default:
      return jsonRpcError(id, -32601, `Unknown tool: ${name}`);
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  let id: MCPId | null = null;

  try {
    const body: unknown = await request.json();
    const envelope = mcpRequestSchema.safeParse(body);

    if (!envelope.success) {
      return jsonRpcError(null, -32600, "Invalid Request");
    }

    id = envelope.data.id;
    const { method, params } = envelope.data;

    if (method === "initialize") {
      return jsonRpcSuccess(id, {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "ai-saas-mcp", version: "1.0.0" },
      });
    }

    if (method === "tools/list") {
      return jsonRpcSuccess(id, { tools: TOOLS });
    }

    const auth = validateAdminToken(request.headers.get("authorization"));
    if (!auth.success) {
      return jsonRpcError(id, auth.code, auth.message);
    }

    if (method === "tools/call") {
      return handleToolCall(id, params);
    }

    return jsonRpcError(id, -32601, `Method not found: ${method}`);
  } catch (error) {
    const message =
      error instanceof SyntaxError ? "Parse error" : "Internal error";
    const code = error instanceof SyntaxError ? -32700 : -32603;
    return jsonRpcError(id, code, message);
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      name: "ai-saas-mcp",
      version: "1.0.0",
      protocolVersion: MCP_PROTOCOL_VERSION,
      tools: TOOLS.map((t) => t.name),
    },
    { status: 200 }
  );
}
