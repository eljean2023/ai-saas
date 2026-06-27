import prisma from "@/lib/prisma";
import { AgentContext, ConversationTurn, RagDocument } from "./types";

const MAX_HISTORY_LOGS = 5;
const MAX_RAG_DOCUMENTS = 3;
const MAX_CONTEXT_CHARS = 16_000;
const PROMPT_CHARS_PER_TOKEN = 4;
const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "can", "this", "that", "these", "those",
  "i", "you", "he", "she", "it", "we", "they", "what", "how", "why",
  "when", "where", "who", "which", "and", "but", "or", "so", "for",
  "in", "on", "at", "to", "of", "with", "about", "from",
]);

export class RagContextAgent {
  async retrieve(context: AgentContext): Promise<AgentContext> {
    const [conversationHistory, relatedPosts] = await Promise.all([
      this.fetchConversationHistory(context.userId),
      this.fetchRelatedContent(context.prompt),
    ]);

    const systemDoc = this.buildSystemDocument(context);
    const ragDocuments = this.optimizeDocuments([...relatedPosts, systemDoc]);

    return { ...context, conversationHistory, ragDocuments };
  }

  private async fetchConversationHistory(userId: string): Promise<ConversationTurn[]> {
    const logs = await prisma.aILog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: MAX_HISTORY_LOGS,
      select: { prompt: true, response: true, createdAt: true },
    });

    return logs.reverse().flatMap((log) => [
      {
        role: "user" as const,
        content: log.prompt.slice(0, 600),
        timestamp: log.createdAt,
      },
      {
        role: "assistant" as const,
        content: log.response.slice(0, 1200),
        timestamp: log.createdAt,
      },
    ]);
  }

  private async fetchRelatedContent(prompt: string): Promise<RagDocument[]> {
    const keywords = this.extractKeywords(prompt);
    if (keywords.length === 0) return [];

    const posts = await prisma.blogPost.findMany({
      where: {
        status: "PUBLISHED",
        OR: keywords.flatMap((kw) => [
          { title: { contains: kw, mode: "insensitive" as const } },
          { content: { contains: kw, mode: "insensitive" as const } },
        ]),
      },
      select: { id: true, title: true, content: true },
      take: MAX_RAG_DOCUMENTS,
      orderBy: { updatedAt: "desc" },
    });

    return posts.map((post) => ({
      type: "blog_post" as const,
      content: `[Article: ${post.title}]\n${post.content.slice(0, 800)}`,
      relevanceScore: this.scoreRelevance(post.title + " " + post.content, keywords),
      sourceId: post.id,
    }));
  }

  private buildSystemDocument(context: AgentContext): RagDocument {
    return {
      type: "system_context" as const,
      content: `User role: ${context.userRole}. Current UTC time: ${new Date().toISOString()}.`,
      relevanceScore: 1.0,
      sourceId: "system",
    };
  }

  private extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 3 && !STOP_WORDS.has(word))
      .slice(0, 10);
  }

  private scoreRelevance(content: string, keywords: string[]): number {
    const lower = content.toLowerCase();
    const hits = keywords.filter((kw) => lower.includes(kw)).length;
    return keywords.length > 0 ? hits / keywords.length : 0;
  }

  private optimizeDocuments(documents: RagDocument[]): RagDocument[] {
    const sorted = [...documents].sort((a, b) => b.relevanceScore - a.relevanceScore);

    let budget = MAX_CONTEXT_CHARS;
    const result: RagDocument[] = [];

    for (const doc of sorted) {
      const charCost = Math.ceil(doc.content.length * PROMPT_CHARS_PER_TOKEN);
      if (charCost > budget) continue;

      const isDuplicate = result.some(
        (existing) => existing.content.slice(0, 80) === doc.content.slice(0, 80)
      );
      if (isDuplicate) continue;

      result.push(doc);
      budget -= charCost;
    }

    return result;
  }
}
