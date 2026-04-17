import { NextResponse } from "next/server"
import { apiRouteError } from "@/lib/api-route-error"
import { scheduleService } from "@/lib/services/schedule"
import { createScheduleSchema, scheduleQuerySchema } from "@/lib/validation/schedule"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = scheduleQuerySchema.safeParse({
      teamId: searchParams.get("teamId") ?? undefined,
      employeeId: searchParams.get("employeeId") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
    })
    if (!query.success) {
      return NextResponse.json(
        { error: query.error.issues.map((i) => i.message).join("；") },
        { status: 400 },
      )
    }
    const schedules = await scheduleService.list(query.data)
    return NextResponse.json(schedules)
  } catch (err) {
    return apiRouteError("GET /api/schedules", err, "获取排班列表失败", 500)
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = createScheduleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join("；") },
        { status: 400 },
      )
    }
    const schedule = await scheduleService.create(parsed.data)
    return NextResponse.json(schedule, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "创建排班失败"
    return apiRouteError("POST /api/schedules", err, msg, 400)
  }
}
