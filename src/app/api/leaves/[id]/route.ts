import { NextResponse } from "next/server"
import { apiRouteError } from "@/lib/api-route-error"
import { leaveService } from "@/lib/services/leave"
import { approveLeaveSchema } from "@/lib/validation/leave"

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const leave = await leaveService.getById(id)
    if (!leave) return NextResponse.json({ error: "请假记录不存在" }, { status: 404 })
    return NextResponse.json(leave)
  } catch (err) {
    return apiRouteError("GET /api/leaves/[id]", err, "获取请假记录失败", 500)
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const body = await request.json()
    const parsed = approveLeaveSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join("；") },
        { status: 400 },
      )
    }
    const leave = await leaveService.approve(id, parsed.data)
    return NextResponse.json(leave)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "审批失败"
    return apiRouteError("PATCH /api/leaves/[id]", err, msg, 400)
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    await leaveService.delete(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    return apiRouteError("DELETE /api/leaves/[id]", err, "删除请假记录失败", 500)
  }
}
