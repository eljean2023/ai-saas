import { NextRequest, NextResponse } from "next/server";
import { UserService } from "@/app/services/UserService";
import { getRefreshTokenFromRequest, setRefreshTokenCookie, setUserRoleCookie } from "@/lib/cookies";
import { toApiError } from "@/lib/errors";

function extractRoleFromJwt(token: string): string | null {
  try {
    const [, payload] = token.split(".");
    const padded = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(padded, "base64").toString("utf8");
    return (JSON.parse(json) as { role?: string }).role ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const incomingToken = getRefreshTokenFromRequest(request);

    if (!incomingToken) {
      return NextResponse.json(
        { error: "No refresh token provided" },
        { status: 401 }
      );
    }

    const tokens = await UserService.refreshTokens(incomingToken);

    const response = NextResponse.json(
      { accessToken: tokens.accessToken },
      { status: 200 }
    );

    setRefreshTokenCookie(response, tokens.refreshToken, tokens.expiresAt);

    const role = extractRoleFromJwt(tokens.accessToken);
    if (role) {
      setUserRoleCookie(response, role, tokens.expiresAt);
    }

    return response;
  } catch (error) {
    const { message, statusCode } = toApiError(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
