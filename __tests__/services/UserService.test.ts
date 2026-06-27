import { ConflictError, AuthError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";

jest.mock("@/lib/prisma", () => ({
  default: {
    session: {
      create: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  },
}));

jest.mock("@/app/repositories/UserRepository", () => ({
  UserRepository: {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    setStatus: jest.fn(),
    softDelete: jest.fn(),
    list: jest.fn(),
    countByStatus: jest.fn(),
    countNewSince: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock("@/app/repositories/PostRepository", () => ({
  PostRepository: {
    setStatusByAuthor: jest.fn().mockResolvedValue(0),
  },
}));

jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("$2b$12$hashed"),
  compare: jest.fn(),
}));

jest.mock("crypto", () => ({
  randomBytes: jest.fn(() => ({ toString: jest.fn().mockReturnValue("hex-refresh-token") })),
}));

jest.mock("@/lib/jwt", () => ({
  signAccessToken: jest.fn().mockReturnValue("mock-access-token"),
  REFRESH_TOKEN_EXPIRY_MS: 604800000,
}));

import { UserService } from "@/app/services/UserService";
import { UserRepository } from "@/app/repositories/UserRepository";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

const mockFindByEmail = UserRepository.findByEmail as jest.Mock;
const mockFindById = UserRepository.findById as jest.Mock;
const mockCreate = UserRepository.create as jest.Mock;
const mockSetStatus = UserRepository.setStatus as jest.Mock;
const mockSoftDelete = UserRepository.softDelete as jest.Mock;
const mockBcryptHash = bcrypt.hash as jest.Mock;
const mockBcryptCompare = bcrypt.compare as jest.Mock;
const mockSessionCreate = prisma.session.create as jest.Mock;
const mockSessionFindFirst = prisma.session.findFirst as jest.Mock;
const mockSessionUpdate = prisma.session.update as jest.Mock;

const baseUser = {
  id: "user-1",
  email: "test@example.com",
  role: "USER" as const,
  status: "ACTIVE" as const,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  deletedAt: null,
};

const userWithPassword = { ...baseUser, passwordHash: "$2b$12$hashed" };

beforeEach(() => {
  jest.clearAllMocks();
  mockBcryptHash.mockResolvedValue("$2b$12$hashed");
  mockBcryptCompare.mockResolvedValue(true);
  mockSessionCreate.mockResolvedValue({});
  mockSessionUpdate.mockResolvedValue({});
  mockCreate.mockResolvedValue(baseUser);
  mockFindById.mockResolvedValue(baseUser);
});

describe("UserService.register", () => {
  it("creates a new user and returns tokens when email is not taken", async () => {
    mockFindByEmail.mockResolvedValue(null);

    const result = await UserService.register("test@example.com", "Password1!");

    expect(mockBcryptHash).toHaveBeenCalledWith("Password1!", 12);
    expect(mockCreate).toHaveBeenCalledWith({
      email: "test@example.com",
      passwordHash: "$2b$12$hashed",
    });
    expect(result.user.email).toBe("test@example.com");
    expect(result.tokens.accessToken).toBe("mock-access-token");
  });

  it("throws ConflictError when the email is already registered", async () => {
    mockFindByEmail.mockResolvedValue(userWithPassword);

    await expect(UserService.register("test@example.com", "Password1!")).rejects.toThrow(
      ConflictError
    );
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe("UserService.login", () => {
  it("returns tokens on valid credentials", async () => {
    mockFindByEmail.mockResolvedValue(userWithPassword);
    mockBcryptCompare.mockResolvedValue(true);

    const result = await UserService.login("test@example.com", "Password1!");

    expect(result.user.email).toBe("test@example.com");
    expect(result.tokens.accessToken).toBe("mock-access-token");
  });

  it("throws AuthError when the password is incorrect", async () => {
    mockFindByEmail.mockResolvedValue(userWithPassword);
    mockBcryptCompare.mockResolvedValue(false);

    await expect(UserService.login("test@example.com", "wrong")).rejects.toThrow(AuthError);
  });

  it("runs timing guard and throws AuthError when email is not found", async () => {
    mockFindByEmail.mockResolvedValue(null);
    mockBcryptCompare.mockResolvedValue(false);

    await expect(UserService.login("noone@example.com", "pass")).rejects.toThrow(AuthError);
    expect(mockBcryptCompare).toHaveBeenCalledTimes(1);
  });

  it("throws ForbiddenError when the account is banned", async () => {
    mockFindByEmail.mockResolvedValue({ ...userWithPassword, status: "BANNED" });
    mockBcryptCompare.mockResolvedValue(true);

    await expect(UserService.login("test@example.com", "Password1!")).rejects.toThrow(
      ForbiddenError
    );
  });
});

describe("UserService.refreshTokens", () => {
  const validSession = {
    id: "session-1",
    userId: "user-1",
    refreshToken: "valid-token",
    expiresAt: new Date(Date.now() + 86400000),
    isValid: true,
    createdAt: new Date(),
    user: { id: "user-1", email: "test@example.com", role: "USER", status: "ACTIVE", deletedAt: null },
  };

  it("invalidates the old session and issues new tokens", async () => {
    mockSessionFindFirst.mockResolvedValue(validSession);

    const tokens = await UserService.refreshTokens("valid-token");

    expect(mockSessionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "session-1" }, data: { isValid: false } })
    );
    expect(tokens.accessToken).toBe("mock-access-token");
  });

  it("throws AuthError when the session is not found", async () => {
    mockSessionFindFirst.mockResolvedValue(null);

    await expect(UserService.refreshTokens("bad-token")).rejects.toThrow(AuthError);
  });

  it("throws AuthError when the session is expired", async () => {
    mockSessionFindFirst.mockResolvedValue({
      ...validSession,
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(UserService.refreshTokens("expired-token")).rejects.toThrow(AuthError);
  });

  it("throws ForbiddenError and invalidates session for a banned user", async () => {
    mockSessionFindFirst.mockResolvedValue({
      ...validSession,
      user: { ...validSession.user, status: "BANNED" },
    });

    await expect(UserService.refreshTokens("valid-token")).rejects.toThrow(ForbiddenError);
    expect(mockSessionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isValid: false } })
    );
  });
});

describe("UserService.logout", () => {
  it("invalidates the session by refreshToken", async () => {
    const mockUpdateMany = prisma.session.updateMany as jest.Mock;
    mockUpdateMany.mockResolvedValue({ count: 1 });

    await UserService.logout("some-refresh-token");

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { refreshToken: "some-refresh-token" },
      data: { isValid: false },
    });
  });
});

describe("UserService.setUserStatus", () => {
  it("updates the status of a different user", async () => {
    mockFindById.mockResolvedValue(baseUser);
    mockSetStatus.mockResolvedValue({ ...baseUser, status: "BANNED" });

    const result = await UserService.setUserStatus("admin-id", "user-1", "BANNED");

    expect(result.status).toBe("BANNED");
  });

  it("throws ValidationError when the requester targets themselves", async () => {
    await expect(
      UserService.setUserStatus("user-1", "user-1", "BANNED")
    ).rejects.toThrow(ValidationError);
  });

  it("throws NotFoundError for a non-existent target", async () => {
    mockFindById.mockResolvedValue(null);

    await expect(
      UserService.setUserStatus("admin-id", "missing-user", "BANNED")
    ).rejects.toThrow(NotFoundError);
  });
});

describe("UserService.deleteUser", () => {
  it("soft-deletes a user and invalidates their sessions", async () => {
    mockFindById.mockResolvedValue(baseUser);
    mockSoftDelete.mockResolvedValue({ ...baseUser, deletedAt: new Date() });
    const mockUpdateMany = prisma.session.updateMany as jest.Mock;

    await UserService.deleteUser("admin-id", "user-1");

    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" }, data: { isValid: false } })
    );
    expect(mockSoftDelete).toHaveBeenCalledWith("user-1");
  });

  it("throws ValidationError when deleting own account", async () => {
    await expect(UserService.deleteUser("self-id", "self-id")).rejects.toThrow(
      ValidationError
    );
  });
});
