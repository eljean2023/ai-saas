export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = this.constructor.name;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class AuthError extends AppError {
  constructor(message = "Authentication failed") {
    super("AUTH_ERROR", message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access denied") {
    super("FORBIDDEN", message, 403);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super("VALIDATION_ERROR", message, 400);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super("NOT_FOUND", `${resource} not found`, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super("CONFLICT", message, 409);
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Rate limit exceeded") {
    super("RATE_LIMIT", message, 429);
  }
}

export interface ApiErrorPayload {
  message: string;
  code: string;
  statusCode: number;
}

export function toApiError(error: unknown): ApiErrorPayload {
  if (error instanceof AppError) {
    return { message: error.message, code: error.code, statusCode: error.statusCode };
  }
  return { message: "Internal server error", code: "INTERNAL_ERROR", statusCode: 500 };
}
