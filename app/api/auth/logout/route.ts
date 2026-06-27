import { NextRequest, NextResponse } from "next/server";
import { UserService } from "@/app/services/UserService";
import { getRefreshTokenFromRequest, clearRefreshTokenCookie } from "@/lib/cookies";
import { toApiError } from "@/lib/errors";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const token = getRefreshTokenFromRequest(request);

    if (token) {
      await UserService.logout(token);
    }

    const response = NextResponse.json({ success: true }, { status: 200 });
    clearRefreshTokenCookie(response);

    return response;
  } catch (error) {
    const { message, statusCode } = toApiError(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
