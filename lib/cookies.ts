import { NextRequest, NextResponse } from "next/server";

const REFRESH_TOKEN_COOKIE = "refresh_token";
const USER_ROLE_COOKIE = "user_role";

const secureBase = {
  sameSite: "strict" as const,
  path: "/",
};

export function setRefreshTokenCookie(
  response: NextResponse,
  token: string,
  expiresAt: Date
): void {
  response.cookies.set(REFRESH_TOKEN_COOKIE, token, {
    ...secureBase,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
  });
}

export function clearRefreshTokenCookie(response: NextResponse): void {
  response.cookies.set(REFRESH_TOKEN_COOKIE, "", {
    ...secureBase,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
    maxAge: 0,
  });
}

export function getRefreshTokenFromRequest(request: NextRequest): string | undefined {
  return request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
}

// Non-httpOnly role cookie: readable by Edge middleware for route enforcement.
// Actual authorization is enforced at the API layer via JWT; this is UI-only routing.
export function setUserRoleCookie(
  response: NextResponse,
  role: string,
  expiresAt: Date
): void {
  response.cookies.set(USER_ROLE_COOKIE, role, {
    ...secureBase,
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
  });
}

export function clearUserRoleCookie(response: NextResponse): void {
  response.cookies.set(USER_ROLE_COOKIE, "", {
    ...secureBase,
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
    maxAge: 0,
  });
}
