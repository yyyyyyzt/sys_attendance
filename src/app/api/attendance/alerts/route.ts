import { NextResponse } from "next/server"
import { attendanceService } from "@/lib/services/attendance"
import { alertConfigSchema } from "@/lib/validation/attendance"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const month = searchParams.get("month")
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "请提供有效的 month 参数（YYYY-MM）" }, { status: 400 })
    }

    const config = alertConfigSchema.safeParse({
      lateThreshold: Number(searchParams.get("lateThreshold") ?? 3),
      absentThreshold: Number(searchParams.get("absentThreshold") ?? 1),
      earlyThreshold: Number(searchParams.get("earlyThreshold") ?? 3),
    })
    if (!config.success) {
      return NextResponse.json({ error: "预警阈值参数不正确" }, { status: 400 })
    }

    const teamId = searchParams.get("teamId") ?? undefined
    const alerts = await attendanceService.detectAlerts(month, config.data, teamId)
    return NextResponse.json(alerts)
  } catch {
    return NextResponse.json({ error: "异常检测失败" }, { status: 500 })
  }
}
