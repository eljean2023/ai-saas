import { NextRequest } from "next/server";
import { extractBearerToken, verifyAccessToken, AccessTokenPayload } from "./jwt";
import { ForbiddenError } from "./errors";
import { JwtPayload } from "jsonwebtoken";

export type AdminPayload = AccessTokenPayload & JwtPayload;

export function requireAuth(request: NextRequest): AdminPayload {
  const token = extractBearerToken(request.headers.get("authorization"));
  return verifyAccessToken(token);
}

export function requireAdmin(request: NextRequest): AdminPayload {
  const payload = requireAuth(request);

  if (payload.role !== "ADMIN" && payload.role !== "SUPER_ADMIN") {
    throw new ForbiddenError("Admin role required");
  }

  return payload;
}

export function requireSuperAdmin(request: NextRequest): AdminPayload {
  const payload = requireAuth(request);

  if (payload.role !== "SUPER_ADMIN") {
    throw new ForbiddenError("Super admin role required");
  }

  return payload;
}
