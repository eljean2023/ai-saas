import jwt, { JwtPayload } from "jsonwebtoken";
import { z } from "zod";
import { AuthError } from "./errors";

export const ACCESS_TOKEN_EXPIRY = "15m";
export const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

export type TokenRole = "USER" | "ADMIN" | "SUPER_ADMIN";

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: TokenRole;
}

const accessTokenSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["USER", "ADMIN", "SUPER_ADMIN"]),
});

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET environment variable is not configured");
  return secret;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function verifyAccessToken(token: string): AccessTokenPayload & JwtPayload {
  try {
    const raw = jwt.verify(token, getSecret());
    const parsed = accessTokenSchema.safeParse(raw);

    if (!parsed.success) {
      throw new AuthError("Invalid token payload structure");
    }

    return { ...(raw as JwtPayload), ...parsed.data };
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw new AuthError("Token verification failed");
  }
}

export function extractBearerToken(authHeader: string | null): string {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AuthError("Missing or malformed Authorization header");
  }
  return authHeader.slice(7);
}
