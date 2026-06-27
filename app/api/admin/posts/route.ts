import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PostStatus } from "@prisma/client";
import { PostRepository } from "@/app/repositories/PostRepository";
import { requireAdmin } from "@/lib/adminAuth";
import { toApiError } from "@/lib/errors";
import { slugify } from "@/lib/utils";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(PostStatus).optional(),
  search: z.string().min(1).optional(),
});

const createPostSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  status: z.nativeEnum(PostStatus).default("DRAFT"),
  slug: z.string().min(1).optional(),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    requireAdmin(request);

    const params = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = querySchema.safeParse(params);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters" },
        { status: 400 }
      );
    }

    const { page, pageSize, status, search } = parsed.data;
    const result = await PostRepository.list(
      { status, search },
      { page, pageSize }
    );

    return NextResponse.json(result);
  } catch (error) {
    const { message, statusCode } = toApiError(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const admin = requireAdmin(request);
    const body: unknown = await request.json();
    const parsed = createPostSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { title, content, status, slug } = parsed.data;
    const resolvedSlug = slug ?? slugify(title);

    const existing = await PostRepository.findBySlug(resolvedSlug);
    if (existing) {
      return NextResponse.json(
        { error: `Slug "${resolvedSlug}" is already in use` },
        { status: 409 }
      );
    }

    const post = await PostRepository.create({
      title,
      slug: resolvedSlug,
      content,
      authorId: admin.sub,
      status,
    });

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    const { message, statusCode } = toApiError(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
