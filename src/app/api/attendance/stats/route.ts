import { NextResponse } from "next/server"
import { apiRouteError } from "@/lib/api-route-error"
import { attendanceService } from "@/lib/services/attendance"
import { monthlyStatsQuerySchema } from "@/lib/validation/attendance"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = monthlyStatsQuerySchema.safeParse({
      month: searchParams.get("month") ?? undefined,
      teamId: searchParams.get("teamId") ?? undefined,
    })
    if (!query.success) {
      return NextResponse.json(
        { error: query.error.issues.map((i) => i.message).join("；") },
        { status: 400 },
      )
    }
    const stats = await attendanceService.monthlyStats(query.data.month, query.data.teamId)
    return NextResponse.json(stats)
  } catch (err) {
    return apiRouteError("GET /api/attendance/stats", err, "获取月度统计失败", 500)
  }
}
