import { NextResponse } from "next/server"
import { attendanceService } from "@/lib/services/attendance"
import { updateAttendanceSchema } from "@/lib/validation/attendance"

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const record = await attendanceService.getById(id)
    if (!record) return NextResponse.json({ error: "出勤记录不存在" }, { status: 404 })
    return NextResponse.json(record)
  } catch {
    return NextResponse.json({ error: "获取出勤记录失败" }, { status: 500 })
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
  } catch {
    return NextResponse.json({ error: "更新出勤记录失败" }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    await attendanceService.delete(id)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "删除出勤记录失败" }, { status: 500 })
  }
}
