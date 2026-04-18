import { NextResponse } from "next/server"
import { apiRouteError } from "@/lib/api-route-error"
import { getCurrentUser } from "@/lib/auth/session"
import { AuthError, assert } from "@/lib/auth/rbac"
import { appUserRepo, type AppRole } from "@/lib/repos/app-user"

function sanitize(u: Awaited<ReturnType<typeof appUserRepo.findAll>>[number]) {
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

export async function GET() {
  try {
    const user = await getCurrentUser()
    assert(user, "user.manage")
    const users = await appUserRepo.findAll()
    return NextResponse.json(users.map(sanitize))
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return apiRouteError("GET /api/auth/users", err, "获取用户列表失败", 500)
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    assert(user, "user.manage")
    const body = await request.json()
    const name = String(body?.name ?? "").trim()
    const role = body?.role as AppRole
    const teamId = body?.teamId ?? null

    if (!name) return NextResponse.json({ error: "姓名不能为空" }, { status: 400 })
    if (!["LEADER", "MANAGER", "ADMIN"].includes(role)) {
      return NextResponse.json({ error: "角色无效" }, { status: 400 })
    }
    if (role === "LEADER" && !teamId) {
      return NextResponse.json({ error: "班长必须绑定班组" }, { status: 400 })
    }
    const created = await appUserRepo.create({ name, role, teamId })
    return NextResponse.json(sanitize(created), { status: 201 })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return apiRouteError("POST /api/auth/users", err, "创建用户失败", 500)
  }
}
