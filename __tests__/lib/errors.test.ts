import {
  AppError,
  AuthError,
  ForbiddenError,
  ValidationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  toApiError,
} from "@/lib/errors";

describe("Error classes", () => {
  it("AuthError has code AUTH_ERROR and statusCode 401", () => {
    const err = new AuthError("bad credentials");
    expect(err.code).toBe("AUTH_ERROR");
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe("bad credentials");
    expect(err).toBeInstanceOf(AppError);
  });

  it("ForbiddenError has code FORBIDDEN and statusCode 403", () => {
    const err = new ForbiddenError();
    expect(err.code).toBe("FORBIDDEN");
    expect(err.statusCode).toBe(403);
  });

  it("ValidationError has code VALIDATION_ERROR and statusCode 400", () => {
    const err = new ValidationError("invalid input");
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.statusCode).toBe(400);
  });

  it("NotFoundError includes the resource name in the message", () => {
    const err = new NotFoundError("User");
    expect(err.code).toBe("NOT_FOUND");
    expect(err.statusCode).toBe(404);
    expect(err.message).toContain("User");
  });

  it("ConflictError has statusCode 409", () => {
    const err = new ConflictError("duplicate email");
    expect(err.statusCode).toBe(409);
  });

  it("RateLimitError has statusCode 429", () => {
    const err = new RateLimitError();
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe("RATE_LIMIT");
  });
});

describe("toApiError", () => {
  it("converts an AppError to the correct payload", () => {
    const err = new AuthError("token expired");
    const payload = toApiError(err);
    expect(payload.statusCode).toBe(401);
    expect(payload.code).toBe("AUTH_ERROR");
    expect(payload.message).toBe("token expired");
  });

  it("converts an unknown Error to a 500 INTERNAL_ERROR", () => {
    const payload = toApiError(new Error("unexpected crash"));
    expect(payload.statusCode).toBe(500);
    expect(payload.code).toBe("INTERNAL_ERROR");
  });

  it("converts a non-Error throw to a 500 INTERNAL_ERROR", () => {
    const payload = toApiError("string error");
    expect(payload.statusCode).toBe(500);
    expect(payload.code).toBe("INTERNAL_ERROR");
  });
});
