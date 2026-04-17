import { NextResponse } from "next/server"
import { apiRouteError } from "@/lib/api-route-error"
import { leaveService } from "@/lib/services/leave"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    const shiftDate = searchParams.get("shiftDate")
    const shiftId = searchParams.get("shiftId")

    if (!teamId || !shiftDate || !shiftId) {
      return NextResponse.json(
        { error: "请提供 teamId、shiftDate、shiftId 参数" },
        { status: 400 },
      )
    }

    const candidates = await leaveService.recommendSubstitutes(teamId, shiftDate, shiftId)
    return NextResponse.json(candidates)
  } catch (err) {
    return apiRouteError("GET /api/leaves/substitutes", err, "替补推荐失败", 500)
  }
}
