import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/adminAuth";
import { toApiError } from "@/lib/errors";
import prisma from "@/lib/prisma";

const USER_TOKEN_QUOTA = 10_000;

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { sub: userId } = requireAuth(request);

    const [aggregate, requestCount] = await Promise.all([
      prisma.aILog.aggregate({
        _sum: { tokensUsed: true },
        where: { userId },
      }),
      prisma.aILog.count({ where: { userId } }),
    ]);

    return NextResponse.json({
      tokensUsed: aggregate._sum.tokensUsed ?? 0,
      requestCount,
      quota: USER_TOKEN_QUOTA,
    });
  } catch (error) {
    const { message, statusCode } = toApiError(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
