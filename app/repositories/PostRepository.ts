import { Prisma, PostStatus } from "@prisma/client";
import prisma, { withRetry } from "@/lib/prisma";
import {
  PaginationParams,
  PaginatedResult,
  buildPaginatedResult,
} from "./types";

const authorSelect = {
  id: true,
  email: true,
  role: true,
} satisfies Prisma.UserSelect;

const postWithAuthorInclude = {
  author: { select: authorSelect },
} satisfies Prisma.BlogPostInclude;

export type PostWithAuthor = Prisma.BlogPostGetPayload<{
  include: typeof postWithAuthorInclude;
}>;

export interface PostFilters {
  status?: PostStatus;
  authorId?: string;
  search?: string;
}

export interface CreatePostInput {
  title: string;
  slug: string;
  content: string;
  authorId: string;
  status?: PostStatus;
}

export const PostRepository = {
  async findById(id: string): Promise<PostWithAuthor | null> {
    return withRetry(() =>
      prisma.blogPost.findUnique({
        where: { id },
        include: postWithAuthorInclude,
      })
    );
  },

  async findBySlug(slug: string): Promise<PostWithAuthor | null> {
    return withRetry(() =>
      prisma.blogPost.findUnique({
        where: { slug },
        include: postWithAuthorInclude,
      })
    );
  },

  async create(data: CreatePostInput): Promise<PostWithAuthor> {
    return withRetry(() =>
      prisma.blogPost.create({
        data,
        include: postWithAuthorInclude,
      })
    );
  },

  async update(
    id: string,
    data: Pick<Prisma.BlogPostUpdateInput, "title" | "slug" | "content" | "status">
  ): Promise<PostWithAuthor> {
    return withRetry(() =>
      prisma.blogPost.update({
        where: { id },
        data,
        include: postWithAuthorInclude,
      })
    );
  },

  async delete(id: string): Promise<void> {
    await withRetry(() => prisma.blogPost.delete({ where: { id } }));
  },

  async list(
    filters: PostFilters,
    pagination: PaginationParams
  ): Promise<PaginatedResult<PostWithAuthor>> {
    const where: Prisma.BlogPostWhereInput = {
      ...(filters.status !== undefined && { status: filters.status }),
      ...(filters.authorId !== undefined && { authorId: filters.authorId }),
      ...(filters.search !== undefined && {
        OR: [
          { title: { contains: filters.search, mode: "insensitive" } },
          { content: { contains: filters.search, mode: "insensitive" } },
        ],
      }),
    };

    const [data, total] = await withRetry(() =>
      prisma.$transaction([
        prisma.blogPost.findMany({
          where,
          include: postWithAuthorInclude,
          orderBy: { createdAt: "desc" },
          skip: (pagination.page - 1) * pagination.pageSize,
          take: pagination.pageSize,
        }),
        prisma.blogPost.count({ where }),
      ])
    );

    return buildPaginatedResult(data, total, pagination);
  },

  async setStatusByAuthor(
    authorId: string,
    status: PostStatus
  ): Promise<number> {
    const result = await withRetry(() =>
      prisma.blogPost.updateMany({
        where: { authorId },
        data: { status },
      })
    );
    return result.count;
  },

  async countByStatus(): Promise<Record<PostStatus, number>> {
    const groups = await withRetry(() =>
      prisma.blogPost.groupBy({
        by: ["status"],
        _count: { id: true },
      })
    );

    return groups.reduce<Record<PostStatus, number>>(
      (acc, group) => {
        acc[group.status] = group._count.id;
        return acc;
      },
      { DRAFT: 0, PUBLISHED: 0 }
    );
  },
};
