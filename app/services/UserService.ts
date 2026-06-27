import bcrypt from "bcryptjs";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { UserRepository, UserPublic, UserFilters } from "@/app/repositories/UserRepository";
import { PostRepository } from "@/app/repositories/PostRepository";
import { signAccessToken, REFRESH_TOKEN_EXPIRY_MS, TokenRole } from "@/lib/jwt";
import {
  AuthError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import { Role, UserStatus } from "@prisma/client";
import { PaginationParams, PaginatedResult } from "@/app/repositories/types";

const BCRYPT_ROUNDS = 12;
const TIMING_GUARD_HASH = "$2b$12$LCGFgKGcTFPkWN5C7qHm8eISuFDY9KQpgaVT3RTv3MTTFdPz5vSRK";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface AuthResult {
  user: UserPublic;
  tokens: TokenPair;
}

async function createSessionForUser(
  userId: string,
  email: string,
  role: TokenRole
): Promise<TokenPair> {
  const refreshToken = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

  await prisma.session.create({
    data: { userId, refreshToken, expiresAt, isValid: true },
  });

  const accessToken = signAccessToken({ sub: userId, email, role });
  return { accessToken, refreshToken, expiresAt };
}

export const UserService = {
  async register(email: string, password: string): Promise<AuthResult> {
    const existing = await UserRepository.findByEmail(email);
    if (existing) {
      throw new ConflictError("Email address is already registered");
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await UserRepository.create({ email, passwordHash });
    const tokens = await createSessionForUser(user.id, user.email, user.role);

    return { user, tokens };
  },

  async createByAdmin(
    email: string,
    password: string,
    role: Role = Role.USER
  ): Promise<UserPublic> {
    const existing = await UserRepository.findByEmail(email);
    if (existing) {
      throw new ConflictError("Email address is already registered");
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    return UserRepository.create({ email, passwordHash, role });
  },

  async login(email: string, password: string): Promise<AuthResult> {
    const record = await UserRepository.findByEmail(email);

    if (!record) {
      await bcrypt.compare(password, TIMING_GUARD_HASH);
      throw new AuthError("Invalid credentials");
    }

    const isValid = await bcrypt.compare(password, record.passwordHash);
    if (!isValid) {
      throw new AuthError("Invalid credentials");
    }

    if (record.status === "BANNED") {
      throw new ForbiddenError("This account has been suspended");
    }

    const { passwordHash: _, ...user } = record;
    void _;

    const tokens = await createSessionForUser(user.id, user.email, user.role);
    return { user, tokens };
  },

  async refreshTokens(incomingToken: string): Promise<TokenPair> {
    const session = await prisma.session.findFirst({
      where: { refreshToken: incomingToken, isValid: true },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            status: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new AuthError("Invalid or expired refresh token");
    }

    const { user } = session;

    if (user.status === "BANNED" || user.deletedAt !== null) {
      await prisma.session.update({
        where: { id: session.id },
        data: { isValid: false },
      });
      throw new ForbiddenError("Account is not active");
    }

    await prisma.session.update({
      where: { id: session.id },
      data: { isValid: false },
    });

    return createSessionForUser(user.id, user.email, user.role);
  },

  async logout(refreshToken: string): Promise<void> {
    await prisma.session.updateMany({
      where: { refreshToken },
      data: { isValid: false },
    });
  },

  async getUserById(id: string): Promise<UserPublic> {
    const user = await UserRepository.findById(id);
    if (!user) throw new NotFoundError("User");
    return user;
  },

  async listUsers(
    filters: UserFilters,
    pagination: PaginationParams
  ): Promise<PaginatedResult<UserPublic>> {
    return UserRepository.list(filters, pagination);
  },

  async setUserStatus(
    requesterId: string,
    targetId: string,
    status: UserStatus
  ): Promise<UserPublic> {
    if (requesterId === targetId) {
      throw new ValidationError("Cannot change your own account status");
    }

    const target = await UserRepository.findById(targetId);
    if (!target) throw new NotFoundError("User");

    return UserRepository.setStatus(targetId, status);
  },

  async deleteUser(requesterId: string, targetId: string): Promise<void> {
    if (requesterId === targetId) {
      throw new ValidationError("Cannot delete your own account via this endpoint");
    }

    const target = await UserRepository.findById(targetId);
    if (!target) throw new NotFoundError("User");

    await Promise.all([
      prisma.session.updateMany({
        where: { userId: targetId },
        data: { isValid: false },
      }),
      PostRepository.setStatusByAuthor(targetId, "DRAFT"),
    ]);

    await UserRepository.softDelete(targetId);
  },
};
