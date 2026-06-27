import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AIService } from "@/app/services/AIService";
import { verifyAccessToken, extractBearerToken } from "@/lib/jwt";
import { toApiError } from "@/lib/errors";
import { AIStreamChunk } from "@/app/services/agents/types";

const aiRequestSchema = z.object({
  prompt: z
    .string()
    .min(1, "Prompt cannot be empty")
    .max(10_000, "Prompt exceeds the 10,000 character limit"),
});

function encodeSSE(chunk: AIStreamChunk): string {
  switch (chunk.type) {
    case "text":
      return `data: ${JSON.stringify({ type: "text", content: chunk.content })}\n\n`;
    case "usage":
      return `data: ${JSON.stringify({ type: "usage", tokensUsed: chunk.tokensUsed ?? 0 })}\n\n`;
    case "done":
      return `data: [DONE]\n\n`;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const token = extractBearerToken(request.headers.get("authorization"));
    const { sub: userId, role: userRole } = verifyAccessToken(token);

    const body: unknown = await request.json();
    const parsed = aiRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { prompt } = parsed.data;
    const encoder = new TextEncoder();

    let generator: AsyncGenerator<AIStreamChunk, void, undefined> | null = null;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        generator = AIService.processStreamingPrompt({ userId, userRole, prompt });

        try {
          for await (const chunk of generator) {
            controller.enqueue(encoder.encode(encodeSSE(chunk)));
          }
        } catch (err) {
          const { message } = toApiError(err);
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({ message })}\n\n`
            )
          );
        } finally {
          controller.close();
        }
      },

      async cancel() {
        if (generator) {
          await generator.return(undefined);
        }
      },
    });

    return new NextResponse(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    const { message, statusCode } = toApiError(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
