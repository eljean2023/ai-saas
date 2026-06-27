import type { AIStreamChunk, AgentContext, AnalyticsResult } from "@/app/services/agents/types";

const mockRetrieve = jest.fn();
const mockQuery = jest.fn();
const mockFinalMessage = jest.fn();
const mockMessagesStream = jest.fn();
const mockMessagesCreate = jest.fn();

jest.mock("@anthropic-ai/sdk", () => ({
  default: jest.fn().mockImplementation(() => ({
    messages: {
      stream: mockMessagesStream,
      create: mockMessagesCreate,
    },
  })),
}));

jest.mock("@/app/services/agents/RagContextAgent", () => ({
  RagContextAgent: jest.fn().mockImplementation(() => ({
    retrieve: mockRetrieve,
  })),
}));

jest.mock("@/app/services/agents/AnalyticsAgent", () => ({
  AnalyticsAgent: jest.fn().mockImplementation(() => ({
    query: mockQuery,
  })),
}));

import { OrchestratorAgent } from "@/app/services/agents/OrchestratorAgent";

function makeContext(prompt: string): AgentContext {
  return {
    userId: "user-1",
    userRole: "USER",
    prompt,
    conversationHistory: [],
    ragDocuments: [],
  };
}

function makeTextStream(texts: string[]) {
  return {
    textStream: (async function* () {
      for (const t of texts) yield t;
    })(),
    finalMessage: mockFinalMessage,
  };
}

const defaultAnalyticsResult: AnalyticsResult = {
  query: "",
  summary: "There are 10 users total.",
  data: { type: "user_counts", total: 10, active: 8, banned: 2, newInPeriod: 1 },
};

async function collectChunks(
  gen: AsyncGenerator<AIStreamChunk, void, undefined>
): Promise<AIStreamChunk[]> {
  const results: AIStreamChunk[] = [];
  for await (const chunk of gen) results.push(chunk);
  return results;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = "test-key";

  mockRetrieve.mockImplementation((ctx: AgentContext) =>
    Promise.resolve({ ...ctx, ragDocuments: [], conversationHistory: [] })
  );
  mockQuery.mockResolvedValue(defaultAnalyticsResult);
  mockFinalMessage.mockResolvedValue({ usage: { input_tokens: 10, output_tokens: 20 } });
  mockMessagesStream.mockReturnValue(makeTextStream(["Hello world"]));
  mockMessagesCreate.mockResolvedValue({
    content: [{ type: "text", text: "GENERAL_CHAT" }],
  });
});

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
});

describe("OrchestratorAgent — regex fast-path analytics", () => {
  it("routes 'how many users' to AnalyticsAgent without LLM call", async () => {
    const chunks = await collectChunks(
      new OrchestratorAgent().processStream(makeContext("how many users do we have?"))
    );

    expect(mockQuery).toHaveBeenCalled();
    expect(mockMessagesCreate).not.toHaveBeenCalled();
    expect(mockMessagesStream).not.toHaveBeenCalled();

    const text = chunks.filter((c) => c.type === "text").map((c) => c.content).join("");
    expect(text).toContain("10");
  });

  it("routes 'user count' prompt to AnalyticsAgent", async () => {
    await collectChunks(
      new OrchestratorAgent().processStream(makeContext("show me the user count"))
    );
    expect(mockQuery).toHaveBeenCalled();
    expect(mockMessagesStream).not.toHaveBeenCalled();
  });

  it("routes 'how many posts' to AnalyticsAgent", async () => {
    await collectChunks(
      new OrchestratorAgent().processStream(makeContext("how many posts are there?"))
    );
    expect(mockQuery).toHaveBeenCalled();
  });

  it("always emits a done chunk as the final item", async () => {
    const chunks = await collectChunks(
      new OrchestratorAgent().processStream(makeContext("total users?"))
    );
    expect(chunks.at(-1)?.type).toBe("done");
  });

  it("emits a usage chunk after analytics response", async () => {
    const chunks = await collectChunks(
      new OrchestratorAgent().processStream(makeContext("how many users?"))
    );
    expect(chunks.some((c) => c.type === "usage")).toBe(true);
  });
});

describe("OrchestratorAgent — general chat path", () => {
  it("streams text chunks from LLM for a non-analytics prompt", async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "GENERAL_CHAT" }],
    });
    mockMessagesStream.mockReturnValue(makeTextStream(["Hello ", "there!"]));

    const chunks = await collectChunks(
      new OrchestratorAgent().processStream(makeContext("write me a poem about rain"))
    );

    const text = chunks.filter((c) => c.type === "text").map((c) => c.content).join("");
    expect(text).toBe("Hello there!");
    expect(mockMessagesStream).toHaveBeenCalled();
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("includes RAG documents in the system prompt", async () => {
    mockRetrieve.mockResolvedValue({
      ...makeContext("is there a discount?"),
      ragDocuments: [
        {
          type: "blog_post" as const,
          content: "User previously asked about pricing.",
          relevanceScore: 0.9,
          sourceId: "p1",
        },
      ],
      conversationHistory: [],
    });
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "GENERAL_CHAT" }],
    });
    mockMessagesStream.mockReturnValue(makeTextStream(["Sure, we have discounts."]));

    await collectChunks(
      new OrchestratorAgent().processStream(makeContext("is there a discount?"))
    );

    expect(mockMessagesStream).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining("User previously asked about pricing."),
      })
    );
  });

  it("emits a usage chunk with combined input+output token count", async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "GENERAL_CHAT" }],
    });
    mockFinalMessage.mockResolvedValue({ usage: { input_tokens: 15, output_tokens: 35 } });
    mockMessagesStream.mockReturnValue(makeTextStream(["response"]));

    const chunks = await collectChunks(
      new OrchestratorAgent().processStream(makeContext("what is 2+2?"))
    );

    const usageChunk = chunks.find((c) => c.type === "usage");
    expect(usageChunk?.tokensUsed).toBe(50);
  });
});

describe("OrchestratorAgent — LLM classification fallback", () => {
  it("routes to AnalyticsAgent when LLM returns ANALYTICS_QUERY for ambiguous prompts", async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "ANALYTICS_QUERY" }],
    });

    await collectChunks(
      new OrchestratorAgent().processStream(makeContext("give me a breakdown of things"))
    );

    expect(mockQuery).toHaveBeenCalled();
    expect(mockMessagesStream).not.toHaveBeenCalled();
  });

  it("routes to chat when LLM returns GENERAL_CHAT", async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "GENERAL_CHAT" }],
    });
    mockMessagesStream.mockReturnValue(makeTextStream(["Sure!"]));

    await collectChunks(
      new OrchestratorAgent().processStream(makeContext("help me understand machine learning"))
    );

    expect(mockMessagesStream).toHaveBeenCalled();
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("falls back to GENERAL_CHAT when LLM returns an unrecognized label", async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "UNKNOWN_LABEL" }],
    });
    mockMessagesStream.mockReturnValue(makeTextStream(["Fallback response"]));

    await collectChunks(
      new OrchestratorAgent().processStream(makeContext("do something unusual"))
    );

    expect(mockMessagesStream).toHaveBeenCalled();
  });
});
