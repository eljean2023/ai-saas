import { NextRequest } from "next/server";
import { AuthError, ConflictError, ValidationError } from "@/lib/errors";

jest.mock("@/app/services/UserService", () => ({
  UserService: {
    login: jest.fn(),
    register: jest.fn(),
    refreshTokens: jest.fn(),
    logout: jest.fn(),
  },
}));

jest.mock("@/lib/cookies", () => ({
  REFRESH_TOKEN_COOKIE: "refresh_token",
  setRefreshTokenCookie: jest.fn(),
  clearRefreshTokenCookie: jest.fn(),
  getRefreshTokenFromRequest: jest.fn(),
}));

import { UserService } from "@/app/services/UserService";
import { setRefreshTokenCookie, clearRefreshTokenCookie, getRefreshTokenFromRequest } from "@/lib/cookies";
import { POST as loginHandler } from "@/app/api/auth/login/route";
import { POST as registerHandler } from "@/app/api/auth/register/route";
import { POST as refreshHandler } from "@/app/api/auth/refresh/route";
import { POST as logoutHandler } from "@/app/api/auth/logout/route";

const mockLogin = UserService.login as jest.Mock;
const mockRegister = UserService.register as jest.Mock;
const mockRefreshTokens = UserService.refreshTokens as jest.Mock;
const mockLogout = UserService.logout as jest.Mock;
const mockSetRefreshCookie = setRefreshTokenCookie as jest.Mock;
const mockClearRefreshCookie = clearRefreshTokenCookie as jest.Mock;
const mockGetRefreshToken = getRefreshTokenFromRequest as jest.Mock;

const tokenExpiresAt = new Date(Date.now() + 604800000);
const authResult = {
  user: { id: "u1", email: "user@example.com", role: "USER", status: "ACTIVE" },
  tokens: {
    accessToken: "access-token-value",
    refreshToken: "refresh-token-value",
    expiresAt: tokenExpiresAt,
  },
};

function makeJsonRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("POST /api/auth/login", () => {
  it("returns 200 with accessToken on valid credentials", async () => {
    mockLogin.mockResolvedValue(authResult);

    const req = makeJsonRequest("http://localhost/api/auth/login", {
      email: "user@example.com",
      password: "Password1!",
    });
    const res = await loginHandler(req);

    expect(res.status).toBe(200);
    const body = await res.json() as { accessToken: string };
    expect(body.accessToken).toBe("access-token-value");
    expect(mockSetRefreshCookie).toHaveBeenCalledWith(
      expect.anything(),
      "refresh-token-value",
      expect.any(Date)
    );
  });

  it("returns 400 when required fields are missing", async () => {
    const req = makeJsonRequest("http://localhost/api/auth/login", { email: "user@example.com" });
    const res = await loginHandler(req);
    expect(res.status).toBe(400);
  });

  it("returns 401 when credentials are invalid", async () => {
    mockLogin.mockRejectedValue(new AuthError("Invalid credentials"));

    const req = makeJsonRequest("http://localhost/api/auth/login", {
      email: "user@example.com",
      password: "wrongpass",
    });
    const res = await loginHandler(req);
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/register", () => {
  it("returns 201 with accessToken on valid registration data", async () => {
    mockRegister.mockResolvedValue(authResult);

    const req = makeJsonRequest("http://localhost/api/auth/register", {
      email: "new@example.com",
      password: "Password1!",
    });
    const res = await registerHandler(req);

    expect(res.status).toBe(201);
    const body = await res.json() as { accessToken: string };
    expect(body.accessToken).toBe("access-token-value");
    expect(mockSetRefreshCookie).toHaveBeenCalledWith(
      expect.anything(),
      "refresh-token-value",
      expect.any(Date)
    );
  });

  it("returns 400 when password does not meet requirements", async () => {
    const req = makeJsonRequest("http://localhost/api/auth/register", {
      email: "user@example.com",
      password: "weak",
    });
    const res = await registerHandler(req);
    expect(res.status).toBe(400);
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("returns 409 when the email is already in use", async () => {
    mockRegister.mockRejectedValue(new ConflictError("Email already registered"));

    const req = makeJsonRequest("http://localhost/api/auth/register", {
      email: "taken@example.com",
      password: "Password1!",
    });
    const res = await registerHandler(req);
    expect(res.status).toBe(409);
  });

  it("returns 400 when the email format is invalid", async () => {
    const req = makeJsonRequest("http://localhost/api/auth/register", {
      email: "not-an-email",
      password: "Password1!",
    });
    const res = await registerHandler(req);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/refresh", () => {
  it("returns 200 with a new accessToken when the refresh cookie is valid", async () => {
    mockGetRefreshToken.mockReturnValue("stored-refresh-token");
    mockRefreshTokens.mockResolvedValue({
      accessToken: "new-access-token",
      refreshToken: "new-refresh-token",
      expiresAt: new Date(Date.now() + 604800000),
    });

    const req = new NextRequest("http://localhost/api/auth/refresh", {
      method: "POST",
      headers: { Cookie: "refresh_token=stored-refresh-token" },
    });
    const res = await refreshHandler(req);

    expect(res.status).toBe(200);
    const body = await res.json() as { accessToken: string };
    expect(body.accessToken).toBe("new-access-token");
    expect(mockSetRefreshCookie).toHaveBeenCalledWith(expect.anything(), "new-refresh-token");
  });

  it("returns 401 when no refresh cookie is present", async () => {
    mockGetRefreshToken.mockReturnValue(null);

    const req = new NextRequest("http://localhost/api/auth/refresh", { method: "POST" });
    const res = await refreshHandler(req);

    expect(res.status).toBe(401);
    expect(mockRefreshTokens).not.toHaveBeenCalled();
  });

  it("returns 401 when the refresh token is expired or invalid", async () => {
    mockGetRefreshToken.mockReturnValue("bad-token");
    mockRefreshTokens.mockRejectedValue(new AuthError("Session expired"));

    const req = new NextRequest("http://localhost/api/auth/refresh", {
      method: "POST",
      headers: { Cookie: "refresh_token=bad-token" },
    });
    const res = await refreshHandler(req);

    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("returns 200 and clears the cookie when refresh token is present", async () => {
    mockGetRefreshToken.mockReturnValue("valid-refresh-token");
    mockLogout.mockResolvedValue(undefined);

    const req = new NextRequest("http://localhost/api/auth/logout", {
      method: "POST",
      headers: { Cookie: "refresh_token=valid-refresh-token" },
    });
    const res = await logoutHandler(req);

    expect(res.status).toBe(200);
    expect(mockLogout).toHaveBeenCalledWith("valid-refresh-token");
    expect(mockClearRefreshCookie).toHaveBeenCalled();
  });

  it("returns 200 even when no refresh cookie is present", async () => {
    mockGetRefreshToken.mockReturnValue(null);

    const req = new NextRequest("http://localhost/api/auth/logout", { method: "POST" });
    const res = await logoutHandler(req);

    expect(res.status).toBe(200);
    expect(mockLogout).not.toHaveBeenCalled();
  });
});
