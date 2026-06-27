import prisma from "@/lib/prisma";
import { UserRepository } from "@/app/repositories/UserRepository";
import { OrchestratorAgent } from "./agents/OrchestratorAgent";
import { AuthError, ForbiddenError, RateLimitError } from "@/lib/errors";
import { AIStreamChunk, AgentContext } from "./agents/types";
import { TokenRole } from "@/lib/jwt";

const AI_RATE_LIMIT_PER_HOUR = 60;

export interface AIRequestContext {
  userId: string;
  userRole: TokenRole;
  prompt: string;
}

async function validateActiveUser(userId: string): Promise<void> {
  const user = await UserRepository.findById(userId);
  if (!user) throw new AuthError("User session references a deleted account");
  if (user.status === "BANNED") throw new ForbiddenError("Account is suspended");
}

async function enforceRateLimit(userId: string): Promise<void> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const requestCount = await prisma.aILog.count({
    where: { userId, createdAt: { gte: oneHourAgo } },
  });

  if (requestCount >= AI_RATE_LIMIT_PER_HOUR) {
    throw new RateLimitError(
      `Hourly AI request limit of ${AI_RATE_LIMIT_PER_HOUR} reached. Try again later.`
    );
  }
}

export const AIService = {
  async *processStreamingPrompt(
    request: AIRequestContext
  ): AsyncGenerator<AIStreamChunk, void, undefined> {
    await validateActiveUser(request.userId);
    await enforceRateLimit(request.userId);

    const agentContext: AgentContext = {
      userId: request.userId,
      userRole: request.userRole,
      prompt: request.prompt,
      conversationHistory: [],
      ragDocuments: [],
    };

    const orchestrator = new OrchestratorAgent();
    let fullResponse = "";
    let tokensUsed = 0;

    try {
      for await (const chunk of orchestrator.processStream(agentContext)) {
        if (chunk.type === "text") {
          fullResponse += chunk.content;
        }
        if (chunk.type === "usage" && chunk.tokensUsed !== undefined) {
          tokensUsed = chunk.tokensUsed;
        }
        yield chunk;
      }
    } finally {
      if (fullResponse.length > 0) {
        await prisma.aILog.create({
          data: {
            userId: request.userId,
            prompt: request.prompt,
            response: fullResponse,
            tokensUsed,
            endpoint: "/api/ai",
          },
        });
      }
    }
  },
};
