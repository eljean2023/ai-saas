import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { UserService } from "@/app/services/UserService";
import { UserRepository } from "@/app/repositories/UserRepository";
import { requireAdmin } from "@/lib/adminAuth";
import { toApiError, ForbiddenError } from "@/lib/errors";

async function guardAgainstSuperAdminTarget(
  executorRole: string,
  targetId: string
): Promise<void> {
  if (executorRole !== "ADMIN") return;
  const target = await UserRepository.findById(targetId);
  if (target?.role === "SUPER_ADMIN") {
    throw new ForbiddenError("Admins cannot modify or delete super admins");
  }
}

const patchSchema = z.object({
  status: z.enum(["ACTIVE", "BANNED"]).optional(),
  role: z.enum(["USER", "ADMIN", "SUPER_ADMIN"]).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const admin = requireAdmin(request);
    await guardAgainstSuperAdminTarget(admin.role, params.id);
    const body: unknown = await request.json();
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { status, role } = parsed.data;

    if (status !== undefined) {
      const user = await UserService.setUserStatus(admin.sub, params.id, status);
      return NextResponse.json({ user });
    }

    if (role !== undefined) {
      if (role === "SUPER_ADMIN" && admin.role !== "SUPER_ADMIN") {
        throw new ForbiddenError("Only super admins can grant the super_admin role");
      }
      const user = await UserRepository.update(params.id, { role });
      return NextResponse.json({ user });
    }

    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
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
    const admin = requireAdmin(request);
    await guardAgainstSuperAdminTarget(admin.role, params.id);
    await UserService.deleteUser(admin.sub, params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const { message, statusCode } = toApiError(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
