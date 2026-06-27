jest.mock("@/lib/prisma", () => ({
  default: {
    aILog: {
      aggregate: jest.fn(),
    },
  },
}));

jest.mock("@/app/repositories/UserRepository", () => ({
  UserRepository: {
    countByStatus: jest.fn(),
    countNewSince: jest.fn(),
    list: jest.fn(),
  },
}));

jest.mock("@/app/repositories/PostRepository", () => ({
  PostRepository: {
    countByStatus: jest.fn(),
  },
}));

import { AnalyticsAgent } from "@/app/services/agents/AnalyticsAgent";
import { UserRepository } from "@/app/repositories/UserRepository";
import { PostRepository } from "@/app/repositories/PostRepository";
import prisma from "@/lib/prisma";
import type { AgentContext } from "@/app/services/agents/types";

const mockCountByStatus = UserRepository.countByStatus as jest.Mock;
const mockCountNewSince = UserRepository.countNewSince as jest.Mock;
const mockUserList = UserRepository.list as jest.Mock;
const mockPostCountByStatus = PostRepository.countByStatus as jest.Mock;
const mockAiLogAggregate = prisma.aILog.aggregate as jest.Mock;

const agent = new AnalyticsAgent();

function makeContext(prompt: string): AgentContext {
  return {
    userId: "user-1",
    userRole: "USER",
    prompt,
    conversationHistory: [],
    ragDocuments: [],
  };
}

const paginatedUsers = {
  data: [
    { id: "u1", email: "a@a.com", role: "USER", status: "ACTIVE", createdAt: new Date() },
  ],
  total: 1,
  page: 1,
  pageSize: 20,
  totalPages: 1,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCountByStatus.mockResolvedValue({ ACTIVE: 8, BANNED: 2 });
  mockCountNewSince.mockResolvedValue(3);
  mockUserList.mockResolvedValue(paginatedUsers);
  mockPostCountByStatus.mockResolvedValue({ DRAFT: 4, PUBLISHED: 6 });
  mockAiLogAggregate.mockResolvedValue({ _count: { id: 100 }, _sum: { tokensUsed: 5000 } });
});

describe("AnalyticsAgent.query", () => {
  it("resolves user_counts with correct totals for 'how many users' prompt", async () => {
    const result = await agent.query(makeContext("how many users do we have?"));

    expect(result.data.type).toBe("user_counts");
    if (result.data.type !== "user_counts") return;
    expect(result.data.total).toBe(10);
    expect(result.data.active).toBe(8);
    expect(result.data.banned).toBe(2);
  });

  it("resolves post_counts for 'how many posts' prompt", async () => {
    const result = await agent.query(makeContext("how many posts are published?"));

    expect(result.data.type).toBe("post_counts");
    if (result.data.type !== "post_counts") return;
    expect(result.data.published).toBe(6);
    expect(result.data.drafts).toBe(4);
  });

  it("resolves ai_usage for 'ai usage' prompt", async () => {
    const result = await agent.query(makeContext("show ai usage stats for this month"));

    expect(result.data.type).toBe("ai_usage");
    if (result.data.type !== "ai_usage") return;
    expect(result.data.requests).toBe(100);
    expect(result.data.tokens).toBe(5000);
  });

  it("resolves user_list for 'list of users' prompt", async () => {
    const result = await agent.query(makeContext("show me the list of users"));

    expect(result.data.type).toBe("user_list");
    if (result.data.type !== "user_list") return;
    expect(result.data.users).toHaveLength(1);
    expect(result.data.users[0].email).toBe("a@a.com");
  });

  it("resolves user_list with banned status for 'banned users' prompt", async () => {
    const result = await agent.query(makeContext("show me all banned users"));

    expect(result.data.type).toBe("user_list");
  });

  it("falls back to user_counts for unrecognized prompts", async () => {
    const result = await agent.query(makeContext("xyzzy completely unrecognized zork"));
    expect(result.data.type).toBe("user_counts");
  });

  it("always returns a non-empty summary string", async () => {
    const result = await agent.query(makeContext("how many users?"));
    expect(typeof result.summary).toBe("string");
    expect(result.summary.length).toBeGreaterThan(0);
  });

  it("includes user totals in the summary for user_counts", async () => {
    const result = await agent.query(makeContext("total users"));
    expect(result.summary).toContain("10");
    expect(result.summary).toContain("8");
  });

  it("includes post numbers in the summary for post_counts", async () => {
    const result = await agent.query(makeContext("how many posts"));
    expect(result.summary).toContain("6");
    expect(result.summary).toContain("4");
  });

  it("includes request and token counts in the summary for ai_usage", async () => {
    const result = await agent.query(makeContext("ai usage stats"));
    expect(result.summary).toContain("100");
    expect(result.summary).toContain("5000");
  });
});
