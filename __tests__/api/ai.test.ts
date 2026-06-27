import { NextRequest } from "next/server";
import { RateLimitError, ForbiddenError } from "@/lib/errors";
import type { AIStreamChunk } from "@/app/services/agents/types";

jest.mock("@/app/services/AIService", () => ({
  AIService: {
    processStreamingPrompt: jest.fn(),
  },
}));

jest.mock("@/lib/jwt", () => ({
  extractBearerToken: jest.fn(),
  verifyAccessToken: jest.fn(),
}));

import { AIService } from "@/app/services/AIService";
import { extractBearerToken, verifyAccessToken } from "@/lib/jwt";
import { POST as aiHandler } from "@/app/api/ai/route";

const mockProcessStream = AIService.processStreamingPrompt as jest.Mock;
const mockExtractBearer = extractBearerToken as jest.Mock;
const mockVerifyToken = verifyAccessToken as jest.Mock;

const validPayload = { sub: "user-1", email: "user@example.com", role: "USER" };

function makeJsonRequest(body: unknown, authHeader?: string): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authHeader) headers["Authorization"] = authHeader;
  return new NextRequest("http://localhost/api/ai", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

async function* makeChunkGen(
  chunks: AIStreamChunk[]
): AsyncGenerator<AIStreamChunk, void, undefined> {
  for (const chunk of chunks) yield chunk;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockExtractBearer.mockReturnValue("valid-token");
  mockVerifyToken.mockReturnValue(validPayload);
  mockProcessStream.mockImplementation(async function* () {
    yield { type: "done" as const, content: "" };
  });
});

describe("POST /api/ai — pre-stream auth and validation", () => {
  it("returns 401 JSON when extractBearerToken throws AuthError", async () => {
    const { AuthError } = await import("@/lib/errors");
    mockExtractBearer.mockImplementation(() => {
      throw new AuthError("Missing token");
    });

    const req = makeJsonRequest({ prompt: "Hello" });
    const res = await aiHandler(req);

    expect(res.status).toBe(401);
    expect(res.headers.get("Content-Type")).toContain("application/json");
  });

  it("returns 401 JSON when verifyAccessToken throws AuthError", async () => {
    const { AuthError } = await import("@/lib/errors");
    mockVerifyToken.mockImplementation(() => {
      throw new AuthError("Invalid JWT");
    });

    const req = makeJsonRequest({ prompt: "Hello" }, "Bearer bad-token");
    const res = await aiHandler(req);

    expect(res.status).toBe(401);
  });

  it("returns 400 JSON when the prompt field is missing", async () => {
    const req = makeJsonRequest({}, "Bearer valid-token");
    const res = await aiHandler(req);

    expect(res.status).toBe(400);
    expect(mockProcessStream).not.toHaveBeenCalled();
  });

  it("returns 400 JSON when the prompt exceeds the 10,000-character limit", async () => {
    const req = makeJsonRequest({ prompt: "x".repeat(10_001) }, "Bearer valid-token");
    const res = await aiHandler(req);

    expect(res.status).toBe(400);
    expect(mockProcessStream).not.toHaveBeenCalled();
  });
});

describe("POST /api/ai — streaming response", () => {
  it("returns 200 with text/event-stream Content-Type on a valid request", async () => {
    mockProcessStream.mockImplementation(() =>
      makeChunkGen([
        { type: "text", content: "Hello" },
        { type: "usage", content: "", tokensUsed: 30 },
        { type: "done", content: "" },
      ])
    );

    const req = makeJsonRequest({ prompt: "Tell me something" }, "Bearer valid-token");
    const res = await aiHandler(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
  });

  it("calls processStreamingPrompt with userId and prompt from the JWT", async () => {
    const req = makeJsonRequest({ prompt: "Hello world" }, "Bearer valid-token");
    await aiHandler(req);

    expect(mockProcessStream).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", prompt: "Hello world" })
    );
  });

  it("passes userRole from the JWT payload to the service", async () => {
    mockVerifyToken.mockReturnValue({
      sub: "admin-1",
      email: "admin@example.com",
      role: "ADMIN",
    });

    const req = makeJsonRequest({ prompt: "Admin query" }, "Bearer admin-token");
    await aiHandler(req);

    expect(mockProcessStream).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "admin-1", userRole: "ADMIN" })
    );
  });

  it("returns 200 SSE response when rate limit is hit inside the stream", async () => {
    mockProcessStream.mockImplementation(async function* () {
      throw new RateLimitError();
    });

    const req = makeJsonRequest({ prompt: "Hello" }, "Bearer valid-token");
    const res = await aiHandler(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
  });

  it("returns 200 SSE response when account is banned and error is caught in stream", async () => {
    mockProcessStream.mockImplementation(async function* () {
      throw new ForbiddenError("Account banned");
    });

    const req = makeJsonRequest({ prompt: "Hello" }, "Bearer valid-token");
    const res = await aiHandler(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
  });

  it("sets X-Accel-Buffering header to disable proxy buffering", async () => {
    const req = makeJsonRequest({ prompt: "Hello" }, "Bearer valid-token");
    const res = await aiHandler(req);

    expect(res.headers.get("X-Accel-Buffering")).toBe("no");
  });
});
