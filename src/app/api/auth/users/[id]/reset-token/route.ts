import { NextResponse } from "next/server"
import { apiRouteError } from "@/lib/api-route-error"
import { getCurrentUser } from "@/lib/auth/session"
import { AuthError, assert } from "@/lib/auth/rbac"
import { appUserRepo } from "@/lib/repos/app-user"

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Params) {
  try {
    const viewer = await getCurrentUser()
    assert(viewer, "user.manage")
    const { id } = await params
    const updated = await appUserRepo.resetToken(id)
    return NextResponse.json({
      id: updated.id,
      magicToken: updated.magicToken,
    })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return apiRouteError("POST /api/auth/users/[id]/reset-token", err, "重置失败", 500)
  }
}
