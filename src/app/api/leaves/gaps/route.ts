import { NextResponse } from "next/server"
import { apiRouteError } from "@/lib/api-route-error"
import { teamRepo } from "@/lib/repos/team"
import { leaveService } from "@/lib/services/leave"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    const from = searchParams.get("from")
    const to = searchParams.get("to")

    if (!from || !to) {
      return NextResponse.json({ error: "请提供 from、to 参数（teamId 可选，省略则汇总全部班组）" }, { status: 400 })
    }

    const gaps = teamId
      ? await leaveService.detectGaps(teamId, from, to)
      : (
          await Promise.all(
            (await teamRepo.findAll()).map((t) => leaveService.detectGaps(t.id, from, to)),
          )
        ).flat()
    return NextResponse.json(gaps)
  } catch (err) {
    return apiRouteError("GET /api/leaves/gaps", err, "缺口检测失败", 500)
  }
}
