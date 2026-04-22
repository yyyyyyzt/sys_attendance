import { NextResponse } from "next/server"
import { apiRouteError } from "@/lib/api-route-error"
import { leaveService } from "@/lib/services/leave"
import { approveLeaveSchema, cancelLeaveSchema } from "@/lib/validation/leave"
import { getCurrentUser } from "@/lib/auth/session"
import { AuthError, assert, can } from "@/lib/auth/rbac"
import { employeeRepo } from "@/lib/repos/employee"

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const viewer = await getCurrentUser()
    if (!viewer) throw new AuthError("未登录", 401)
    const { id } = await params
    const leave = await leaveService.getById(id)
    if (!leave) return NextResponse.json({ error: "请假记录不存在" }, { status: 404 })

    if (viewer.role === "LEADER") {
      const emp = await employeeRepo.findById(leave.employeeId)
      if (!emp || emp.teamId !== viewer.teamId) {
        throw new AuthError("无此权限", 403)
      }
    }
    return NextResponse.json(leave)
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return apiRouteError("GET /api/leaves/[id]", err, "获取请假记录失败", 500)
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const viewer = await getCurrentUser()
    if (!viewer) throw new AuthError("未登录", 401)

    const { id } = await params
    const body = await request.json()

    const existing = await leaveService.getById(id)
    if (!existing) return NextResponse.json({ error: "请假记录不存在" }, { status: 404 })
    const emp = await employeeRepo.findById(existing.employeeId)
    if (!emp) return NextResponse.json({ error: "请假对应员工已不存在" }, { status: 400 })

    const approved = approveLeaveSchema.safeParse(body)
    if (approved.success) {
      // 审批：仅 MANAGER / ADMIN
      assert(viewer, "leave.approve")
      // approverId 以当前登录用户为准
      const input = { ...approved.data, approverId: viewer.id }
      const leave = await leaveService.approve(id, input)
      return NextResponse.json(leave)
    }

    const cancelled = cancelLeaveSchema.safeParse(body)
    if (cancelled.success) {
      // 撤销：班长仅能撤销本组；MANAGER/ADMIN 全权
      if (viewer.role === "LEADER") {
        assert(viewer, "leave.cancel", { teamId: emp.teamId })
      } else if (!can(viewer, "leave.cancel")) {
        throw new AuthError("无此权限", 403)
      }
      const leave = await leaveService.cancel(id)
      return NextResponse.json(leave)
    }

    return NextResponse.json(
      { error: "请求体无效：审批请传 {status:\"approved\"|\"rejected\"}；撤销请传 {status:\"cancelled\"}" },
      { status: 400 },
    )
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    const msg = err instanceof Error ? err.message : "更新失败"
    return apiRouteError("PATCH /api/leaves/[id]", err, msg, 400)
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const viewer = await getCurrentUser()
    if (!viewer) throw new AuthError("未登录", 401)
    const { id } = await params
    const existing = await leaveService.getById(id)
    if (!existing) return NextResponse.json({ success: true })
    const emp = await employeeRepo.findById(existing.employeeId)
    if (viewer.role === "LEADER") {
      assert(viewer, "leave.cancel", { teamId: emp?.teamId ?? null })
    } else if (viewer.role === "MANAGER") {
      // MANAGER 可删
    }
    await leaveService.delete(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return apiRouteError("DELETE /api/leaves/[id]", err, "删除请假记录失败", 500)
  }
}
