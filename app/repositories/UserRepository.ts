import { Prisma, Role, UserStatus } from "@prisma/client";
import prisma, { withRetry } from "@/lib/prisma";
import {
  PaginationParams,
  PaginatedResult,
  buildPaginatedResult,
} from "./types";

const userPublicSelect = {
  id: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} satisfies Prisma.UserSelect;

export type UserPublic = Prisma.UserGetPayload<{
  select: typeof userPublicSelect;
}>;

export type UserWithPassword = Prisma.UserGetPayload<{
  select: {
    id: true;
    email: true;
    passwordHash: true;
    role: true;
    status: true;
    createdAt: true;
    updatedAt: true;
    deletedAt: true;
  };
}>;

export interface UserFilters {
  role?: Role;
  status?: UserStatus;
  search?: string;
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  role?: Role;
}

export const UserRepository = {
  async findById(id: string): Promise<UserPublic | null> {
    return withRetry(() =>
      prisma.user.findFirst({
        where: { id, deletedAt: null },
        select: userPublicSelect,
      })
    );
  },

  async findByEmail(email: string): Promise<UserWithPassword | null> {
    return withRetry(() =>
      prisma.user.findFirst({
        where: { email, deletedAt: null },
        select: {
          id: true,
          email: true,
          passwordHash: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
        },
      })
    );
  },

  async create(data: CreateUserInput): Promise<UserPublic> {
    return withRetry(() =>
      prisma.user.create({
        data,
        select: userPublicSelect,
      })
    );
  },

  async update(
    id: string,
    data: Pick<Prisma.UserUpdateInput, "email" | "role" | "status">
  ): Promise<UserPublic> {
    return withRetry(() =>
      prisma.user.update({
        where: { id },
        data,
        select: userPublicSelect,
      })
    );
  },

  async setStatus(id: string, status: UserStatus): Promise<UserPublic> {
    return withRetry(() =>
      prisma.user.update({
        where: { id },
        data: { status },
        select: userPublicSelect,
      })
    );
  },

  async softDelete(id: string): Promise<UserPublic> {
    return withRetry(() =>
      prisma.user.update({
        where: { id },
        data: { deletedAt: new Date() },
        select: userPublicSelect,
      })
    );
  },

  async list(
    filters: UserFilters,
    pagination: PaginationParams
  ): Promise<PaginatedResult<UserPublic>> {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(filters.role !== undefined && { role: filters.role }),
      ...(filters.status !== undefined && { status: filters.status }),
      ...(filters.search !== undefined && {
        email: { contains: filters.search, mode: "insensitive" },
      }),
    };

    const [data, total] = await withRetry(() =>
      prisma.$transaction([
        prisma.user.findMany({
          where,
          select: userPublicSelect,
          orderBy: { createdAt: "desc" },
          skip: (pagination.page - 1) * pagination.pageSize,
          take: pagination.pageSize,
        }),
        prisma.user.count({ where }),
      ])
    );

    return buildPaginatedResult(data, total, pagination);
  },

  async countByStatus(): Promise<Record<UserStatus, number>> {
    const groups = await withRetry(() =>
      prisma.user.groupBy({
        by: ["status"],
        where: { deletedAt: null },
        _count: { id: true },
      })
    );

    return groups.reduce<Record<UserStatus, number>>(
      (acc, group) => {
        acc[group.status] = group._count.id;
        return acc;
      },
      { ACTIVE: 0, BANNED: 0 }
    );
  },

  async countNewSince(since: Date): Promise<number> {
    return withRetry(() =>
      prisma.user.count({
        where: { createdAt: { gte: since }, deletedAt: null },
      })
    );
  },
};
