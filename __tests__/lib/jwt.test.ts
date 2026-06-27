import { signAccessToken, verifyAccessToken, extractBearerToken } from "@/lib/jwt";
import { AuthError } from "@/lib/errors";

const TEST_SECRET = "test-jwt-secret-at-least-32-chars!!";

beforeEach(() => {
  process.env.JWT_SECRET = TEST_SECRET;
});

afterEach(() => {
  delete process.env.JWT_SECRET;
});

describe("signAccessToken + verifyAccessToken", () => {
  it("round-trips a valid payload correctly", () => {
    const payload = { sub: "user-1", email: "test@example.com", role: "ADMIN" as const };
    const token = signAccessToken(payload);
    const decoded = verifyAccessToken(token);

    expect(decoded.sub).toBe("user-1");
    expect(decoded.email).toBe("test@example.com");
    expect(decoded.role).toBe("ADMIN");
  });

  it("throws AuthError on a malformed token", () => {
    expect(() => verifyAccessToken("not.a.valid.jwt")).toThrow(AuthError);
  });

  it("throws AuthError when the secret does not match", () => {
    const token = signAccessToken({ sub: "u1", email: "x@x.com", role: "USER" });
    process.env.JWT_SECRET = "completely-different-secret-here!!!";
    expect(() => verifyAccessToken(token)).toThrow(AuthError);
  });

  it("throws when JWT_SECRET is missing", () => {
    delete process.env.JWT_SECRET;
    expect(() =>
      signAccessToken({ sub: "u1", email: "x@x.com", role: "USER" })
    ).toThrow();
  });
});

describe("extractBearerToken", () => {
  it("extracts the token from a valid Authorization header", () => {
    const token = extractBearerToken("Bearer my-token-string");
    expect(token).toBe("my-token-string");
  });

  it("throws AuthError when the header is null", () => {
    expect(() => extractBearerToken(null)).toThrow(AuthError);
  });

  it("throws AuthError when the header is malformed", () => {
    expect(() => extractBearerToken("Basic dXNlcjpwYXNz")).toThrow(AuthError);
    expect(() => extractBearerToken("Bearer")).toThrow(AuthError);
  });
});
