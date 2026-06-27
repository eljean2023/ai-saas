import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var _prisma: PrismaClient | undefined;
}

const prisma = globalThis._prisma ?? new PrismaClient({ log: ["error", "warn"] });

if (process.env.NODE_ENV !== "production") {
  globalThis._prisma = prisma;
}

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  // Neon serverless compute wake-up: SqlState E57P01 (admin_shutdown)
  if (error.message.includes("E57P01")) return true;
  // Prisma P1001 = can't reach server, P1002 = database timeout
  const code = (error as unknown as Record<string, unknown>).code;
  if (typeof code === "string" && ["P1001", "P1002"].includes(code)) return true;
  return false;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error) || attempt === maxAttempts) throw error;
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

export default prisma;
