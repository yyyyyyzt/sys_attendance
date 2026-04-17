import { NextResponse } from "next/server"
import { apiRouteError } from "@/lib/api-route-error"
import { scheduleService } from "@/lib/services/schedule"
import { scheduleQuerySchema } from "@/lib/validation/schedule"
import { exportSchedulesToXlsx } from "@/lib/scheduling/excel"
import type { ScheduleExportRow } from "@/lib/scheduling/excel"

const statusLabels: Record<string, string> = {
  scheduled: "已排班",
  leave: "请假",
  cancelled: "已取消",
  completed: "已完成",
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = scheduleQuerySchema.safeParse({
      teamId: searchParams.get("teamId") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
    })
    if (!query.success) {
      return NextResponse.json({ error: "参数不正确" }, { status: 400 })
    }
    if (!query.data.from || !query.data.to) {
      return NextResponse.json({ error: "请指定开始和结束日期" }, { status: 400 })
    }

    const schedules = await scheduleService.list(query.data)
    const rows: ScheduleExportRow[] = schedules.map((s: { shiftDate: string; team: { name: string }; employee: { name: string }; shift: { name: string; startTime: string; endTime: string }; status: string; note: string | null }) => ({
      日期: s.shiftDate,
      班组: s.team.name,
      员工: s.employee.name,
      班次: `${s.shift.name}（${s.shift.startTime}–${s.shift.endTime}）`,
      状态: statusLabels[s.status] ?? s.status,
      备注: s.note ?? "",
    }))

    const buffer = exportSchedulesToXlsx(rows)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="schedules.xlsx"`,
      },
    })
  } catch (err) {
    return apiRouteError("GET /api/export/schedules", err, "导出失败", 500)
  }
}
