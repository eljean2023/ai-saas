import { RateLimitError, ForbiddenError } from "@/lib/errors";
import type { AIStreamChunk } from "@/app/services/agents/types";

jest.mock("@/lib/prisma", () => ({
  default: {
    aILog: {
      count: jest.fn(),
      create: jest.fn().mockResolvedValue({}),
    },
  },
}));

jest.mock("@/app/repositories/UserRepository", () => ({
  UserRepository: {
    findById: jest.fn(),
  },
}));

jest.mock("@/app/services/agents/OrchestratorAgent", () => ({
  OrchestratorAgent: jest.fn().mockImplementation(() => ({
    processStream: jest.fn(),
  })),
}));

import { AIService } from "@/app/services/AIService";
import { UserRepository } from "@/app/repositories/UserRepository";
import prisma from "@/lib/prisma";
import { OrchestratorAgent } from "@/app/services/agents/OrchestratorAgent";

const mockFindById = UserRepository.findById as jest.Mock;
const mockAiLogCount = prisma.aILog.count as jest.Mock;
const mockAiLogCreate = prisma.aILog.create as jest.Mock;

const MockOrchestrator = OrchestratorAgent as jest.MockedClass<typeof OrchestratorAgent>;

const activeUser = {
  id: "user-1",
  email: "user@example.com",
  role: "USER" as const,
  status: "ACTIVE" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

async function collectChunks(
  gen: AsyncGenerator<AIStreamChunk, void, undefined>
): Promise<AIStreamChunk[]> {
  const results: AIStreamChunk[] = [];
  for await (const chunk of gen) {
    results.push(chunk);
  }
  return results;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFindById.mockResolvedValue(activeUser);
  mockAiLogCount.mockResolvedValue(0);
  mockAiLogCreate.mockResolvedValue({});
});

describe("AIService.processStreamingPrompt", () => {
  it("throws RateLimitError when the per-hour limit is exceeded", async () => {
    mockAiLogCount.mockResolvedValue(60);

    const gen = AIService.processStreamingPrompt({
      userId: "user-1",
      userRole: "USER",
      prompt: "Hello",
    });

    await expect(collectChunks(gen)).rejects.toThrow(RateLimitError);
  });

  it("throws ForbiddenError when the user account is banned", async () => {
    mockFindById.mockResolvedValue({ ...activeUser, status: "BANNED" });
    mockAiLogCount.mockResolvedValue(0);

    const gen = AIService.processStreamingPrompt({
      userId: "user-1",
      userRole: "USER",
      prompt: "Hello",
    });

    await expect(collectChunks(gen)).rejects.toThrow(ForbiddenError);
  });

  it("yields text, usage, and done chunks from the orchestrator", async () => {
    const chunks: AIStreamChunk[] = [
      { type: "text", content: "Hello" },
      { type: "text", content: " world" },
      { type: "usage", content: "", tokensUsed: 42 },
      { type: "done", content: "" },
    ];

    MockOrchestrator.mockImplementation(
      () =>
        ({
          processStream: async function* () {
            for (const c of chunks) yield c;
          },
        }) as unknown as OrchestratorAgent
    );

    const gen = AIService.processStreamingPrompt({
      userId: "user-1",
      userRole: "USER",
      prompt: "Hello",
    });

    const result = await collectChunks(gen);

    expect(result.filter((c) => c.type === "text")).toHaveLength(2);
    expect(result.find((c) => c.type === "usage")?.tokensUsed).toBe(42);
    expect(result.at(-1)?.type).toBe("done");
  });

  it("persists an AILog entry in the finally block even on generator error", async () => {
    MockOrchestrator.mockImplementation(
      () =>
        ({
          processStream: async function* () {
            yield { type: "text" as const, content: "partial" };
            throw new Error("model failure");
          },
        }) as unknown as OrchestratorAgent
    );

    const gen = AIService.processStreamingPrompt({
      userId: "user-1",
      userRole: "USER",
      prompt: "Fail me",
    });

    await expect(collectChunks(gen)).rejects.toThrow("model failure");

    expect(mockAiLogCreate).toHaveBeenCalledTimes(1);
    expect(mockAiLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: "user-1" }) })
    );
  });

  it("persists an AILog entry on successful completion", async () => {
    MockOrchestrator.mockImplementation(
      () =>
        ({
          processStream: async function* () {
            yield { type: "text" as const, content: "Done" };
            yield { type: "usage" as const, content: "", tokensUsed: 10 };
            yield { type: "done" as const, content: "" };
          },
        }) as unknown as OrchestratorAgent
    );

    const gen = AIService.processStreamingPrompt({
      userId: "user-1",
      userRole: "USER",
      prompt: "Query",
    });

    await collectChunks(gen);

    expect(mockAiLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tokensUsed: 10, userId: "user-1" }),
      })
    );
  });
});
