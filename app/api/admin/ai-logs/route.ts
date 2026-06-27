import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";
import { toApiError } from "@/lib/errors";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  userId: z.string().optional(),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    requireAdmin(request);

    const params = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = querySchema.safeParse(params);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
    }

    const { limit, userId } = parsed.data;

    const logs = await prisma.aILog.findMany({
      where: userId ? { userId } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        userId: true,
        prompt: true,
        response: true,
        tokensUsed: true,
        endpoint: true,
        createdAt: true,
        user: { select: { email: true } },
      },
    });

    const totalStats = await prisma.aILog.aggregate({
      _sum: { tokensUsed: true },
      _count: { id: true },
    });

    return NextResponse.json({
      logs,
      stats: {
        totalRequests: totalStats._count.id,
        totalTokens: totalStats._sum.tokensUsed ?? 0,
      },
    });
  } catch (error) {
    const { message, statusCode } = toApiError(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
