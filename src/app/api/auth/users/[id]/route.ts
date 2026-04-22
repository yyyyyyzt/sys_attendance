import { NextResponse } from "next/server"
import { apiRouteError } from "@/lib/api-route-error"
import { getCurrentUser } from "@/lib/auth/session"
import { AuthError, assert } from "@/lib/auth/rbac"
import { appUserRepo, type AppRole } from "@/lib/repos/app-user"

type Params = { params: Promise<{ id: string }> }

function sanitize(u: Awaited<ReturnType<typeof appUserRepo.findById>>) {
  if (!u) return null
  return {
    id: u.id,
    name: u.name,
    role: u.role,
    teamId: u.teamId,
    teamName: u.teamName,
    magicToken: u.magicToken,
    disabled: u.disabled,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const viewer = await getCurrentUser()
    assert(viewer, "user.manage")
    const { id } = await params
    const body = await request.json()
    const patch: {
      name?: string
      role?: AppRole
      teamId?: string | null
      disabled?: boolean
    } = {}
    if (typeof body?.name === "string") patch.name = body.name.trim()
    if (typeof body?.role === "string" && ["LEADER", "MANAGER", "ADMIN"].includes(body.role)) {
      patch.role = body.role as AppRole
    }
    if (body?.teamId !== undefined) patch.teamId = body.teamId ?? null
    if (typeof body?.disabled === "boolean") patch.disabled = body.disabled

    const updated = await appUserRepo.update(id, patch)
    return NextResponse.json(sanitize(updated))
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return apiRouteError("PATCH /api/auth/users/[id]", err, "更新用户失败", 500)
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const viewer = await getCurrentUser()
    assert(viewer, "user.manage")
    const { id } = await params
    if (viewer && viewer.id === id) {
      return NextResponse.json({ error: "不能删除自己" }, { status: 400 })
    }
    await appUserRepo.delete(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return apiRouteError("DELETE /api/auth/users/[id]", err, "删除用户失败", 500)
  }
}
