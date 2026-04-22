import { NextResponse } from "next/server"
import { apiRouteError } from "@/lib/api-route-error"
import { leaveService } from "@/lib/services/leave"
import { createLeaveSchema, leaveQuerySchema } from "@/lib/validation/leave"
import { getCurrentUser } from "@/lib/auth/session"
import { AuthError, assert, can } from "@/lib/auth/rbac"
import { employeeRepo } from "@/lib/repos/employee"

export async function GET(request: Request) {
  try {
    const viewer = await getCurrentUser()
    if (!viewer) throw new AuthError("未登录", 401)
    const { searchParams } = new URL(request.url)
    const query = leaveQuerySchema.safeParse({
      employeeId: searchParams.get("employeeId") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
    })
    if (!query.success) {
      return NextResponse.json(
        { error: query.error.issues.map((i) => i.message).join("；") },
        { status: 400 },
      )
    }

    // 班长只能看本组的请假：在应用层过滤
    let leaves = await leaveService.list(query.data)
    if (viewer.role === "LEADER") {
      const myEmps = await employeeRepo.findAll(viewer.teamId ?? undefined)
      const allowed = new Set(myEmps.map((e) => e.id))
      leaves = leaves.filter((l) => allowed.has(l.employeeId))
    }
    return NextResponse.json(leaves)
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return apiRouteError("GET /api/leaves", err, "获取请假列表失败", 500)
  }
}

export async function POST(request: Request) {
  try {
    const viewer = await getCurrentUser()
    if (!viewer) throw new AuthError("未登录", 401)

    const body = await request.json()
    const parsed = createLeaveSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join("；") },
        { status: 400 },
      )
    }

    // 只允许班长给本组员工、或总经理/管理员替任意员工提交
    const emp = await employeeRepo.findById(parsed.data.employeeId)
    if (!emp) return NextResponse.json({ error: "员工不存在" }, { status: 400 })

    if (viewer.role === "LEADER") {
      assert(viewer, "leave.create", { teamId: emp.teamId })
    } else if (!can(viewer, "leave.approve")) {
      // MANAGER/ADMIN 由 can 放行；其它角色拒绝
      throw new AuthError("无此权限", 403)
    }

    const leave = await leaveService.create(parsed.data)
    return NextResponse.json(leave, { status: 201 })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    const msg = err instanceof Error ? err.message : "创建请假申请失败"
    return apiRouteError("POST /api/leaves", err, msg, 400)
  }
}
