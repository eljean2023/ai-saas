import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Role, UserStatus } from "@prisma/client";
import { UserRepository } from "@/app/repositories/UserRepository";
import { UserService } from "@/app/services/UserService";
import { requireAuth, requireSuperAdmin } from "@/lib/adminAuth";
import { toApiError } from "@/lib/errors";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(UserStatus).optional(),
  role: z.nativeEnum(Role).optional(),
  search: z.string().min(1).optional(),
});

const createUserSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must not exceed 128 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  role: z.enum(["USER", "ADMIN", "SUPER_ADMIN"]).default("USER"),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    requireAuth(request);

    const params = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = querySchema.safeParse(params);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { page, pageSize, status, role, search } = parsed.data;
    const result = await UserRepository.list(
      { status, role, search },
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
    requireSuperAdmin(request);

    const body: unknown = await request.json();
    const parsed = createUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email, password, role } = parsed.data;
    const user = await UserService.createByAdmin(email, password, role as Role);

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    const { message, statusCode } = toApiError(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
