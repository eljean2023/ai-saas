import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  const hasSession = !!request.cookies.get("refresh_token")?.value;
  const role = request.cookies.get("user_role")?.value;

  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";
  const isUser = role === "USER";

  if (pathname.startsWith("/admin")) {
    if (!hasSession) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    // Block USER role from admin zone
    if (isUser) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/dashboard")) {
    if (!hasSession) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    // Push admins to their zone
    if (isAdmin) {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // Skip redirect on /login and / when role cookie is absent (token may have rotated)
  if (hasSession && role) {
    if (pathname === "/login" || pathname === "/") {
      return NextResponse.redirect(
        new URL(isAdmin ? "/admin/dashboard" : "/dashboard", request.url)
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/dashboard/:path*", "/admin/:path*"],
};
