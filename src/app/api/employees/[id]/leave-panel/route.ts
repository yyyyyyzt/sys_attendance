import { NextResponse } from "next/server"
import { apiRouteError } from "@/lib/api-route-error"
import { employeeService } from "@/lib/services/employee"
import { leaveRepo } from "@/lib/repos/leave"
import { leavePolicyService } from "@/lib/services/leave-policy"

type Params = { params: Promise<{ id: string }> }

/**
 * GET /api/employees/:id/leave-panel?year=YYYY
 *
 * 班长查员工假期面板：返回剩余额度、上限型累计用量、今年请假历史。
 */
export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const yearParam = searchParams.get("year")
    const year = yearParam ? Number(yearParam) : new Date().getFullYear()
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: "年份参数不合法" }, { status: 400 })
    }

    const employee = await employeeService.getById(id)
    if (!employee) return NextResponse.json({ error: "员工不存在" }, { status: 404 })

    const usage = await leavePolicyService.summarizeUsage(id, year)

    const allLeaves = await leaveRepo.findAll({ employeeId: id })
    const yearStart = `${year}-01-01`
    const yearEnd = `${year}-12-31`
    const history = allLeaves
      .filter((l) => !(l.endDate < yearStart || l.startDate > yearEnd))
      .map((l) => ({
        id: l.id,
        leaveType: l.leaveType,
        startDate: l.startDate,
        endDate: l.endDate,
        hours: Number(l.hours),
        reason: l.reason,
        status: l.status,
        createdAt: l.createdAt,
      }))

    return NextResponse.json({ employee, year, usage, history })
  } catch (err) {
    return apiRouteError("GET /api/employees/[id]/leave-panel", err, "获取员工假期面板失败", 500)
  }
}
