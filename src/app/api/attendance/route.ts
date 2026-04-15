import { NextResponse } from "next/server"
import { attendanceService } from "@/lib/services/attendance"
import { createAttendanceSchema, attendanceQuerySchema } from "@/lib/validation/attendance"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = attendanceQuerySchema.safeParse({
      employeeId: searchParams.get("employeeId") ?? undefined,
      teamId: searchParams.get("teamId") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    })
    if (!query.success) {
      return NextResponse.json(
        { error: query.error.issues.map((i) => i.message).join("；") },
        { status: 400 },
      )
    }
    const records = await attendanceService.list(query.data)
    return NextResponse.json(records)
  } catch {
    return NextResponse.json({ error: "获取出勤记录失败" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = createAttendanceSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join("；") },
        { status: 400 },
      )
    }
    const record = await attendanceService.create(parsed.data)
    return NextResponse.json(record, { status: 201 })
  } catch {
    return NextResponse.json({ error: "创建出勤记录失败" }, { status: 500 })
  }
}
