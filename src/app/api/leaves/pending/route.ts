import { NextResponse } from "next/server"
import { apiRouteError } from "@/lib/api-route-error"
import { leaveRepo } from "@/lib/repos/leave"
import { employeeRepo } from "@/lib/repos/employee"

/**
 * GET /api/leaves/pending?teamId=...
 *
 * 总经理查看待审批工单队列（所有 pending 的请假，按提交时间倒序）。
 * teamId 可选，不传则返回全部班组。
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId") ?? undefined

    const leaves = await leaveRepo.findAll({ status: "pending" })
    let filtered = leaves
    if (teamId) {
      const teamEmps = await employeeRepo.findAll(teamId)
      const set = new Set(teamEmps.map((e) => e.id))
      filtered = leaves.filter((l) => set.has(l.employeeId))
    }

    const items = filtered.map((l) => ({
      id: l.id,
      employeeId: l.employeeId,
      employeeName: l.employee?.name ?? "",
      leaveType: l.leaveType,
      startDate: l.startDate,
      endDate: l.endDate,
      hours: Number(l.hours),
      reason: l.reason,
      createdAt: l.createdAt,
    }))

    return NextResponse.json({ count: items.length, items })
  } catch (err) {
    return apiRouteError("GET /api/leaves/pending", err, "查询待审批队列失败", 500)
  }
}
