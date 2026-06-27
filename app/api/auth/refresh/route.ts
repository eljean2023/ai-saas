import { NextRequest, NextResponse } from "next/server";
import { UserService } from "@/app/services/UserService";
import { getRefreshTokenFromRequest, setRefreshTokenCookie } from "@/lib/cookies";
import { toApiError } from "@/lib/errors";

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

    return response;
  } catch (error) {
    const { message, statusCode } = toApiError(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
