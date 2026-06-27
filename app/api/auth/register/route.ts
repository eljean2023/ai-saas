import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { UserService } from "@/app/services/UserService";
import { setRefreshTokenCookie } from "@/lib/cookies";
import { toApiError } from "@/lib/errors";

const registerSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must not exceed 128 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: unknown = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;
    const { user, tokens } = await UserService.register(email, password);

    const response = NextResponse.json(
      { user, accessToken: tokens.accessToken },
      { status: 201 }
    );

    setRefreshTokenCookie(response, tokens.refreshToken, tokens.expiresAt);

    return response;
  } catch (error) {
    const { message, statusCode } = toApiError(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
