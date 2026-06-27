import { TokenRole } from "@/lib/jwt";

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface RagDocument {
  type: "conversation_history" | "blog_post" | "system_context";
  content: string;
  relevanceScore: number;
  sourceId: string;
}

export interface AgentContext {
  userId: string;
  userRole: TokenRole;
  prompt: string;
  conversationHistory: ConversationTurn[];
  ragDocuments: RagDocument[];
}

export type PromptIntent =
  | "ANALYTICS_QUERY"
  | "CONTENT_GENERATION"
  | "RAG_RETRIEVAL"
  | "MODERATION"
  | "GENERAL_CHAT";

export interface AIStreamChunk {
  type: "text" | "usage" | "done";
  content: string;
  tokensUsed?: number;
}

export type AnalyticsData =
  | {
      type: "user_counts";
      total: number;
      active: number;
      banned: number;
      newInPeriod: number;
    }
  | { type: "post_counts"; published: number; drafts: number }
  | { type: "ai_usage"; requests: number; tokens: number }
  | {
      type: "user_list";
      users: Array<{
        id: string;
        email: string;
        role: string;
        status: string;
        createdAt: Date;
      }>;
    };

export interface AnalyticsResult {
  query: string;
  data: AnalyticsData;
  summary: string;
}
