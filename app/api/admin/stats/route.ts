import { NextRequest, NextResponse } from "next/server";
import { UserRepository } from "@/app/repositories/UserRepository";
import { PostRepository } from "@/app/repositories/PostRepository";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/adminAuth";
import { toApiError } from "@/lib/errors";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    requireAuth(request);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [userCounts, newThisWeek, postCounts, aiToday] = await Promise.all([
      UserRepository.countByStatus(),
      UserRepository.countNewSince(oneWeekAgo),
      PostRepository.countByStatus(),
      prisma.aILog.aggregate({
        where: { createdAt: { gte: today } },
        _count: { id: true },
        _sum: { tokensUsed: true },
      }),
    ]);

    return NextResponse.json({
      users: {
        total: userCounts.ACTIVE + userCounts.BANNED,
        active: userCounts.ACTIVE,
        banned: userCounts.BANNED,
        newThisWeek,
      },
      content: {
        published: postCounts.PUBLISHED,
        drafts: postCounts.DRAFT,
      },
      ai: {
        requestsToday: aiToday._count.id,
        tokensToday: aiToday._sum.tokensUsed ?? 0,
      },
    });
  } catch (error) {
    const { message, statusCode } = toApiError(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
