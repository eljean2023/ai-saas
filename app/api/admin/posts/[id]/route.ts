import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PostStatus } from "@prisma/client";
import { PostRepository } from "@/app/repositories/PostRepository";
import { requireAdmin } from "@/lib/adminAuth";
import { toApiError, NotFoundError } from "@/lib/errors";
import { slugify } from "@/lib/utils";

const patchSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: z.string().min(1).optional(),
  status: z.nativeEnum(PostStatus).optional(),
  slug: z.string().min(1).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    requireAdmin(request);

    const existing = await PostRepository.findById(params.id);
    if (!existing) throw new NotFoundError("Post");

    const body: unknown = await request.json();
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { title, content, status, slug } = parsed.data;
    const resolvedSlug = slug ?? (title ? slugify(title) : undefined);

    if (resolvedSlug && resolvedSlug !== existing.slug) {
      const slugConflict = await PostRepository.findBySlug(resolvedSlug);
      if (slugConflict) {
        return NextResponse.json(
          { error: `Slug "${resolvedSlug}" is already in use` },
          { status: 409 }
        );
      }
    }

    const post = await PostRepository.update(params.id, {
      ...(title !== undefined && { title }),
      ...(content !== undefined && { content }),
      ...(status !== undefined && { status }),
      ...(resolvedSlug !== undefined && { slug: resolvedSlug }),
    });

    return NextResponse.json({ post });
  } catch (error) {
    const { message, statusCode } = toApiError(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    requireAdmin(request);

    const existing = await PostRepository.findById(params.id);
    if (!existing) throw new NotFoundError("Post");

    await PostRepository.delete(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const { message, statusCode } = toApiError(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
