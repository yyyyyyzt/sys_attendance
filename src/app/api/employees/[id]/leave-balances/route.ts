import { NextResponse } from "next/server"
import { apiRouteError } from "@/lib/api-route-error"
import { leaveBalanceRepo } from "@/lib/repos/leave-balance"
import { employeeRepo } from "@/lib/repos/employee"
import { LEAVE_TYPES, isLeaveType } from "@/lib/types/leave"

type Params = { params: Promise<{ id: string }> }

/**
 * GET /api/employees/:id/leave-balances?year=YYYY
 *
 * 返回该员工该年度所有假期类型的账户（不存在的自动补 0 占位）。
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

    const employee = await employeeRepo.findById(id)
    if (!employee) return NextResponse.json({ error: "员工不存在" }, { status: 404 })

    const existing = await leaveBalanceRepo.findByEmployee(id, year)
    const byType = new Map(existing.map((b) => [b.leaveType, b]))

    const items = LEAVE_TYPES.map((t) => {
      const acct = byType.get(t)
      return {
        leaveType: t,
        totalHours: acct?.totalHours ?? 0,
        remainingHours: acct?.remainingHours ?? 0,
      }
    })

    return NextResponse.json({ employeeId: id, year, items })
  } catch (err) {
    return apiRouteError("GET /api/employees/[id]/leave-balances", err, "获取员工假期账户失败", 500)
  }
}

/**
 * PUT /api/employees/:id/leave-balances
 * body: { year, items: [{ leaveType, totalHours, remainingHours? }] }
 *
 * 管理员批量覆盖某员工该年度的假期账户。remainingHours 不传时默认 = totalHours。
 */
export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const body = await request.json()
    const year = Number(body?.year)
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: "年份参数不合法" }, { status: 400 })
    }
    const items = Array.isArray(body?.items) ? body.items : []

    const employee = await employeeRepo.findById(id)
    if (!employee) return NextResponse.json({ error: "员工不存在" }, { status: 404 })

    const results = []
    for (const raw of items) {
      const leaveType = raw?.leaveType
      if (!isLeaveType(String(leaveType))) continue
      const totalHours = Number(raw?.totalHours ?? 0)
      if (!Number.isFinite(totalHours) || totalHours < 0) continue
      const remainingHours =
        raw?.remainingHours === undefined || raw?.remainingHours === null
          ? totalHours
          : Number(raw.remainingHours)
      if (!Number.isFinite(remainingHours) || remainingHours < 0) continue

      const saved = await leaveBalanceRepo.upsert({
        employeeId: id,
        year,
        leaveType,
        totalHours,
        remainingHours: Math.min(remainingHours, totalHours),
      })
      results.push(saved)
    }

    return NextResponse.json({ employeeId: id, year, items: results })
  } catch (err) {
    return apiRouteError("PUT /api/employees/[id]/leave-balances", err, "更新员工假期账户失败", 500)
  }
}
