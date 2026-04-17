import { NextResponse } from "next/server"
import { apiRouteError } from "@/lib/api-route-error"
import { attendanceService } from "@/lib/services/attendance"
import { updateAttendanceSchema } from "@/lib/validation/attendance"

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const record = await attendanceService.getById(id)
    if (!record) return NextResponse.json({ error: "出勤记录不存在" }, { status: 404 })
    return NextResponse.json(record)
  } catch (err) {
    return apiRouteError("GET /api/attendance/[id]", err, "获取出勤记录失败", 500)
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const body = await request.json()
    const parsed = updateAttendanceSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join("；") },
        { status: 400 },
      )
    }
    const record = await attendanceService.update(id, parsed.data)
    return NextResponse.json(record)
  } catch (err) {
    return apiRouteError("PATCH /api/attendance/[id]", err, "更新出勤记录失败", 500)
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    await attendanceService.delete(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    return apiRouteError("DELETE /api/attendance/[id]", err, "删除出勤记录失败", 500)
  }
}
