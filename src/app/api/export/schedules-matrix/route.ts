import { NextResponse } from "next/server"
import { apiRouteError } from "@/lib/api-route-error"
import { scheduleService } from "@/lib/services/schedule"
import { exportSchedulesAsMatrix, type MatrixScheduleEntry } from "@/lib/scheduling/excel"

/**
 * GET /api/export/schedules-matrix?from=YYYY-MM-DD&to=YYYY-MM-DD&teamId=...
 *
 * 以 example1.csv 风格的矩阵 xlsx 导出：
 * 第 1 列班组、第 2 列姓名、第 3 列岗位，其后每列一天（YYYY/M/D），
 * 单元格为班次代码；员工当天无排班的格子导出为 "休息"。
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get("from")
    const to = searchParams.get("to")
    const teamId = searchParams.get("teamId") ?? undefined
    if (!from || !to) {
      return NextResponse.json({ error: "请提供 from、to 参数（YYYY-MM-DD）" }, { status: 400 })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return NextResponse.json({ error: "日期格式需为 YYYY-MM-DD" }, { status: 400 })
    }

    const dates = generateDateRange(from, to)
    const schedules = await scheduleService.list({ from, to, teamId })

    const entries = new Map<string, MatrixScheduleEntry>()
    for (const s of schedules) {
      const key = s.employeeId
      let entry = entries.get(key)
      if (!entry) {
        entry = {
          teamName: s.team.name,
          employeeName: s.employee.name,
          position: s.employee.position,
          byDate: {},
        }
        entries.set(key, entry)
      }
      entry.byDate[s.shiftDate] = s.shift.code
    }

    const buffer = exportSchedulesAsMatrix(Array.from(entries.values()), dates)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="schedules-matrix-${from}_${to}.xlsx"`,
      },
    })
  } catch (err) {
    return apiRouteError("GET /api/export/schedules-matrix", err, "导出矩阵失败", 500)
  }
}

function generateDateRange(from: string, to: string): string[] {
  const res: string[] = []
  const s = new Date(from)
  const e = new Date(to)
  const cur = new Date(s)
  while (cur <= e) {
    res.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return res
}
