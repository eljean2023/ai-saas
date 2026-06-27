import { NextRequest, NextResponse } from "next/server";

const REFRESH_TOKEN_COOKIE = "refresh_token";

const baseCookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  path: "/",
} as const;

export function setRefreshTokenCookie(
  response: NextResponse,
  token: string,
  expiresAt: Date
): void {
  response.cookies.set(REFRESH_TOKEN_COOKIE, token, {
    ...baseCookieOptions,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
  });
}

export function clearRefreshTokenCookie(response: NextResponse): void {
  response.cookies.set(REFRESH_TOKEN_COOKIE, "", {
    ...baseCookieOptions,
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
    maxAge: 0,
  });
}

export function getRefreshTokenFromRequest(request: NextRequest): string | undefined {
  return request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
}
