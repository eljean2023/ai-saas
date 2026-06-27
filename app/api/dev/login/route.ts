import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { signAccessToken, REFRESH_TOKEN_EXPIRY_MS, TokenRole } from "@/lib/jwt";
import { setRefreshTokenCookie } from "@/lib/cookies";

const bodySchema = z.object({
  role: z.enum(["USER", "ADMIN", "SUPER_ADMIN"]),
});

const SEED_EMAILS: Record<TokenRole, string> = {
  USER: "dev.user@seed.local",
  ADMIN: "dev.admin@seed.local",
  SUPER_ADMIN: "dev.superadmin@seed.local",
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body: unknown = await request.json();
    const parsed = bodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const { role } = parsed.data;
    const email = SEED_EMAILS[role];

    // Find or create the seed user (hash only on first create)
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const passwordHash = await bcrypt.hash("dev-seed-never-used", 10);
      user = await prisma.user.create({
        data: { email, passwordHash, role, status: "ACTIVE" },
      });
    } else if (user.role !== role || user.status !== "ACTIVE" || user.deletedAt !== null) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { role, status: "ACTIVE", deletedAt: null },
      });
    }

    // Invalidate any stale sessions for this seed user
    await prisma.session.updateMany({
      where: { userId: user.id, isValid: true },
      data: { isValid: false },
    });

    // Create a fresh real session in the DB
    const refreshToken = crypto.randomBytes(48).toString("hex");
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);
    await prisma.session.create({
      data: { userId: user.id, refreshToken, expiresAt, isValid: true },
    });

    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role as TokenRole,
    });

    const response = NextResponse.json(
      { accessToken, user: { id: user.id, email: user.email, role: user.role } },
      { status: 200 }
    );
    setRefreshTokenCookie(response, refreshToken, expiresAt);
    return response;
  } catch (error) {
    console.error("[dev/login]", error);
    return NextResponse.json({ error: "Dev login failed" }, { status: 500 });
  }
}
