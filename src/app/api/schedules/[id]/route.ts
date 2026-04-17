import { NextResponse } from "next/server"
import { apiRouteError } from "@/lib/api-route-error"
import { scheduleService } from "@/lib/services/schedule"
import { updateScheduleSchema } from "@/lib/validation/schedule"

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const schedule = await scheduleService.getById(id)
    if (!schedule) return NextResponse.json({ error: "排班记录不存在" }, { status: 404 })
    return NextResponse.json(schedule)
  } catch (err) {
    return apiRouteError("GET /api/schedules/[id]", err, "获取排班记录失败", 500)
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const body = await request.json()
    const parsed = updateScheduleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join("；") },
        { status: 400 },
      )
    }
    const schedule = await scheduleService.update(id, parsed.data)
    return NextResponse.json(schedule)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "更新排班失败"
    return apiRouteError("PATCH /api/schedules/[id]", err, msg, 400)
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    await scheduleService.delete(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    return apiRouteError("DELETE /api/schedules/[id]", err, "删除排班失败", 500)
  }
}
