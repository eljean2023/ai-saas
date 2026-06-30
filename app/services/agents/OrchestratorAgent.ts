import Anthropic from "@anthropic-ai/sdk";
import { AgentContext, AIStreamChunk, PromptIntent } from "./types";
import { RagContextAgent } from "./RagContextAgent";
import { AnalyticsAgent } from "./AnalyticsAgent";

const CHAT_MODEL = "claude-sonnet-4-6";
const CLASSIFICATION_MODEL = "claude-haiku-4-5-20251001";

const analyticsPatterns: RegExp[] = [
  /how many users/i,
  /total users/i,
  /user count/i,
  /user statistics/i,
  /platform (stats|analytics|metrics)/i,
  /ai usage/i,
  /tokens used/i,
  /api calls/i,
  /registered (users|accounts)/i,
  /how many posts/i,
];

function isApiKeyConfigured(): boolean {
  const key = process.env.ANTHROPIC_API_KEY;
  return typeof key === "string" && key.trim().length > 0;
}

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY environment variable is not configured");
  return new Anthropic({ apiKey });
}

export class OrchestratorAgent {
  private ragAgent = new RagContextAgent();
  private analyticsAgent = new AnalyticsAgent();

  async *processStream(context: AgentContext): AsyncGenerator<AIStreamChunk, void, undefined> {
    if (!isApiKeyConfigured()) {
      yield* this.demoStream(context);
      return;
    }

    const enrichedContext = await this.ragAgent.retrieve(context);
    const intent = await this.classifyIntent(enrichedContext.prompt);

    if (intent === "ANALYTICS_QUERY") {
      const result = await this.analyticsAgent.query(enrichedContext);
      yield { type: "text", content: result.summary };
      yield { type: "usage", content: "", tokensUsed: 0 };
      yield { type: "done", content: "" };
      return;
    }

    const client = getAnthropicClient();
    const systemPrompt = this.buildSystemPrompt(enrichedContext);
    const messages = this.buildMessages(enrichedContext);

    const stream = client.messages.stream({
      model: CHAT_MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield { type: "text", content: event.delta.text };
      }
    }

    const finalMessage = await stream.finalMessage();
    const tokensUsed =
      finalMessage.usage.input_tokens + finalMessage.usage.output_tokens;

    yield { type: "usage", content: "", tokensUsed };
    yield { type: "done", content: "" };
  }

  private async *demoStream(context: AgentContext): AsyncGenerator<AIStreamChunk, void, undefined> {
    const topic = context.prompt.slice(0, 120).replace(/\n/g, " ");

    const pipeline = [
      `OrchestratorAgent: Query intercepted successfully. User role: ${context.userRole}. Routing pipeline initiated.\n`,
      `RagContextAgent: Scanning Neon.tech PostgreSQL for associated metadata rows... `,
      `3 relevant documents fetched (relevance score: 0.94). Context window enriched.\n`,
      `OrchestratorAgent: Intent classified as GENERAL_CHAT. Dispatching to response synthesizer.\n\n`,
      `---\n\n`,
    ];

    const body = this.buildDemoBody(topic);

    const chunks = [...pipeline, ...body];
    for (const chunk of chunks) {
      yield { type: "text", content: chunk };
    }

    yield { type: "usage", content: "", tokensUsed: 142 };
    yield { type: "done", content: "" };
  }

  private buildDemoBody(topic: string): string[] {
    return [
      `Thank you for your message. Here's what I was able to process regarding: *"${topic}"*\n\n`,
      `Based on the context retrieved from our RAG pipeline, your query touches on `,
      `several areas of the platform. The OrchestratorAgent has analysed your request `,
      `and routed it through the full agent stack — including document retrieval, `,
      `intent classification, and response synthesis.\n\n`,
      `**Pipeline summary:**\n`,
      `- **RagContextAgent** — fetched 3 metadata rows from Neon.tech PostgreSQL (latency: 18ms)\n`,
      `- **OrchestratorAgent** — merged context and classified intent in 4ms\n`,
      `- **ResponseSynthesizer** — generated this reply from enriched context\n\n`,
      `> *Note: running in demo mode — Anthropic API key not present in this environment.*\n`,
    ];
  }

  private async classifyIntent(prompt: string): Promise<PromptIntent> {
    if (analyticsPatterns.some((pattern) => pattern.test(prompt))) {
      return "ANALYTICS_QUERY";
    }

    if (!isApiKeyConfigured()) {
      return "GENERAL_CHAT";
    }

    const client = getAnthropicClient();

    const response = await client.messages.create({
      model: CLASSIFICATION_MODEL,
      max_tokens: 20,
      messages: [
        {
          role: "user",
          content: `Classify this user prompt into exactly one category.
Categories: ANALYTICS_QUERY | CONTENT_GENERATION | RAG_RETRIEVAL | MODERATION | GENERAL_CHAT
Prompt: "${prompt.slice(0, 500)}"
Reply with only the category name.`,
        },
      ],
    });

    const firstBlock = response.content[0];
    const label = firstBlock.type === "text" ? firstBlock.text.trim() : "";
    const validIntents: PromptIntent[] = [
      "ANALYTICS_QUERY",
      "CONTENT_GENERATION",
      "RAG_RETRIEVAL",
      "MODERATION",
      "GENERAL_CHAT",
    ];

    return validIntents.includes(label as PromptIntent)
      ? (label as PromptIntent)
      : "GENERAL_CHAT";
  }

  private buildSystemPrompt(context: AgentContext): string {
    const ragSection =
      context.ragDocuments.length > 0
        ? `\n\nRelevant context:\n${context.ragDocuments
            .map((d) => d.content)
            .join("\n---\n")}`
        : "";

    return `You are a helpful AI assistant embedded in a SaaS platform.
User role: ${context.userRole}. Be accurate, concise, and professional.${ragSection}`;
  }

  private buildMessages(context: AgentContext): Anthropic.MessageParam[] {
    const history: Anthropic.MessageParam[] = context.conversationHistory.map((turn) => ({
      role: turn.role,
      content: turn.content,
    }));

    return [...history, { role: "user" as const, content: context.prompt }];
  }
}
