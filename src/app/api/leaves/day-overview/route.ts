import { NextResponse } from "next/server"
import { apiRouteError } from "@/lib/api-route-error"
import { teamRepo } from "@/lib/repos/team"
import { leaveRepo } from "@/lib/repos/leave"
import { shiftRepo } from "@/lib/repos/shift"
import { attendanceService } from "@/lib/services/attendance"
import { employeeRepo } from "@/lib/repos/employee"

/**
 * GET /api/leaves/day-overview?teamId=...&date=YYYY-MM-DD
 *
 * 班长查班组某一天的请假一览 + 班次覆盖风险：
 * - onLeave：当天 pending 或 approved 的请假列表
 * - stillOnDuty：当天本班组有排班且 NOT leave 的员工
 * - shiftCoverage：每个班次需要 / 已安排 的人数
 * - risk: ok | tight | shortage（基于 leaveThreshold 与 shift 需求）
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    const date = searchParams.get("date")
    if (!teamId || !date) {
      return NextResponse.json({ error: "请提供 teamId 和 date 参数" }, { status: 400 })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "date 格式需为 YYYY-MM-DD" }, { status: 400 })
    }

    const team = await teamRepo.findById(teamId)
    if (!team) return NextResponse.json({ error: "班组不存在" }, { status: 404 })

    const teamEmployees = await employeeRepo.findAll(teamId)
    const teamEmpIdSet = new Set(teamEmployees.map((e) => e.id))

    const leaves = await leaveRepo.findAll({ from: date, to: date })
    const teamLeaves = leaves.filter((l) => teamEmpIdSet.has(l.employeeId))
    const onLeave = teamLeaves.map((l) => ({
      id: l.id,
      employeeId: l.employeeId,
      employeeName: l.employee?.name ?? "",
      leaveType: l.leaveType,
      status: l.status,
      hours: Number(l.hours),
      reason: l.reason,
      startDate: l.startDate,
      endDate: l.endDate,
    }))

    const derived = await attendanceService.deriveDailyAttendance({
      from: date,
      to: date,
      teamId,
    })
    const stillOnDuty = derived
      .filter((d) => d.status === "normal")
      .map((d) => ({
        employeeId: d.employeeId,
        employeeName: d.employeeName,
        position: d.position,
        shiftCode: d.shiftCode,
        shiftName: d.shiftName,
      }))

    const shifts = await shiftRepo.findAll()
    const shiftCoverage = shifts.map((sh) => {
      const scheduled = derived.filter(
        (d) => d.shiftCode === sh.code && d.status === "normal",
      ).length
      return {
        shiftId: sh.id,
        shiftCode: sh.code,
        shiftName: sh.name,
        required: sh.requiredCount,
        scheduled,
        gap: Math.max(0, sh.requiredCount - scheduled),
      }
    }).filter((c) => c.scheduled > 0 || c.gap > 0)

    const approvedOrPendingCount = onLeave.filter(
      (l) => l.status === "approved" || l.status === "pending",
    ).length
    const hasShortage = shiftCoverage.some((c) => c.gap > 0)
    let risk: "ok" | "tight" | "shortage" = "ok"
    if (hasShortage) risk = "shortage"
    else if (approvedOrPendingCount >= team.leaveThreshold) risk = "tight"

    return NextResponse.json({
      team: { id: team.id, name: team.name, leaveThreshold: team.leaveThreshold },
      date,
      risk,
      onLeaveCount: approvedOrPendingCount,
      onLeave,
      stillOnDuty,
      shiftCoverage,
    })
  } catch (err) {
    return apiRouteError("GET /api/leaves/day-overview", err, "查询班组当天请假概览失败", 500)
  }
}
