jest.mock("@/lib/prisma", () => ({
  default: {
    aILog: {
      findMany: jest.fn(),
    },
    blogPost: {
      findMany: jest.fn(),
    },
  },
}));

import { RagContextAgent } from "@/app/services/agents/RagContextAgent";
import prisma from "@/lib/prisma";
import type { AgentContext } from "@/app/services/agents/types";

const mockAiLogFindMany = prisma.aILog.findMany as jest.Mock;
const mockBlogPostFindMany = prisma.blogPost.findMany as jest.Mock;

const agent = new RagContextAgent();

function makeContext(prompt: string, userId = "user-1"): AgentContext {
  return {
    userId,
    userRole: "USER",
    prompt,
    conversationHistory: [],
    ragDocuments: [],
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAiLogFindMany.mockResolvedValue([]);
  mockBlogPostFindMany.mockResolvedValue([]);
});

describe("RagContextAgent.retrieve", () => {
  it("returns an AgentContext with conversationHistory and ragDocuments arrays", async () => {
    const result = await agent.retrieve(makeContext("hello world"));
    expect(Array.isArray(result.conversationHistory)).toBe(true);
    expect(Array.isArray(result.ragDocuments)).toBe(true);
    expect(result.userId).toBe("user-1");
    expect(result.prompt).toBe("hello world");
  });

  it("maps prior AI logs into alternating user/assistant conversation turns", async () => {
    mockAiLogFindMany.mockResolvedValue([
      { prompt: "What is AI?", response: "It is intelligence.", createdAt: new Date() },
      { prompt: "Tell me more.", response: "It learns from data.", createdAt: new Date() },
    ]);

    const result = await agent.retrieve(makeContext("next question"));

    expect(result.conversationHistory.length).toBe(4);
    expect(result.conversationHistory[0].role).toBe("user");
    expect(result.conversationHistory[1].role).toBe("assistant");
  });

  it("returns empty conversationHistory when there are no prior logs", async () => {
    mockAiLogFindMany.mockResolvedValue([]);
    const result = await agent.retrieve(makeContext("first question ever", "new-user"));
    expect(result.conversationHistory).toHaveLength(0);
  });

  it("always includes at least the system_context document in ragDocuments", async () => {
    const result = await agent.retrieve(makeContext("some prompt"));
    const hasSystem = result.ragDocuments.some((d) => d.type === "system_context");
    expect(hasSystem).toBe(true);
  });

  it("adds blog_post documents when keywords match published content", async () => {
    mockBlogPostFindMany.mockResolvedValue([
      {
        id: "p1",
        title: "Neural Networks Explained",
        content: "A neural network is a series of algorithms...",
      },
    ]);

    const result = await agent.retrieve(makeContext("explain neural networks please"));

    const blogDocs = result.ragDocuments.filter((d) => d.type === "blog_post");
    expect(blogDocs.length).toBeGreaterThan(0);
    expect(blogDocs[0].content).toContain("Neural Networks");
  });

  it("caps total ragDocuments size within the context budget", async () => {
    const longContent = "word ".repeat(2000);
    mockBlogPostFindMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({
        id: `p${i}`,
        title: `Article ${i}`,
        content: longContent,
      }))
    );

    const result = await agent.retrieve(makeContext("articles content posts data blogs info"));

    const totalChars = result.ragDocuments.reduce((sum, d) => sum + d.content.length, 0);
    expect(totalChars).toBeLessThanOrEqual(16_000 / 4 + 500);
  });

  it("truncates individual log prompts and responses in history", async () => {
    const longPrompt = "word ".repeat(300);
    const longResponse = "answer ".repeat(400);
    mockAiLogFindMany.mockResolvedValue([
      { prompt: longPrompt, response: longResponse, createdAt: new Date() },
    ]);

    const result = await agent.retrieve(makeContext("follow-up question"));

    const userTurn = result.conversationHistory.find((h) => h.role === "user");
    const assistantTurn = result.conversationHistory.find((h) => h.role === "assistant");
    expect(userTurn!.content.length).toBeLessThanOrEqual(600);
    expect(assistantTurn!.content.length).toBeLessThanOrEqual(1200);
  });
});
