/**
 * NL 意图执行器
 * 将 LLM Function Call 解析出的函数名和参数，转化为系统内部 service 调用，
 * 返回结构化结果供 LLM 总结回复用户。
 */

import { prisma } from "@/lib/db"

interface ExecResult {
  success: boolean
  data?: unknown
  error?: string
}

async function findEmployeeByName(name: string) {
  return prisma.employee.findFirst({ where: { name: { contains: name } } })
}

async function findTeamByName(name: string) {
  return prisma.team.findFirst({ where: { name: { contains: name } } })
}

async function findShiftByName(name: string, teamId?: string) {
  const where: Record<string, unknown> = { name: { contains: name } }
  if (teamId) where.teamId = teamId
  return prisma.shift.findFirst({ where })
}

// ─── view_schedule ───────────────────────────────────
async function execViewSchedule(args: Record<string, string>): Promise<ExecResult> {
  const where: Record<string, unknown> = {
    shiftDate: { gte: args.from, lte: args.to },
  }
  if (args.employeeName) {
    const emp = await findEmployeeByName(args.employeeName)
    if (!emp) return { success: false, error: `找不到员工「${args.employeeName}」` }
    where.employeeId = emp.id
  }
  if (args.teamName) {
    const team = await findTeamByName(args.teamName)
    if (!team) return { success: false, error: `找不到班组「${args.teamName}」` }
    where.teamId = team.id
  }
  const schedules = await prisma.schedule.findMany({
    where,
    include: { employee: true, shift: true, team: true },
    orderBy: [{ shiftDate: "asc" }],
    take: 50,
  })
  const rows = schedules.map((s) => ({
    日期: s.shiftDate,
    员工: s.employee.name,
    班组: s.team.name,
    班次: s.shift.name,
    时段: `${s.shift.startTime}-${s.shift.endTime}`,
    状态: s.status,
  }))
  return { success: true, data: { total: schedules.length, rows } }
}

// ─── create_leave ────────────────────────────────────
async function execCreateLeave(args: Record<string, string>): Promise<ExecResult> {
  const emp = await findEmployeeByName(args.employeeName)
  if (!emp) return { success: false, error: `找不到员工「${args.employeeName}」` }
  const typeLabel: Record<string, string> = { annual: "年假", sick: "病假", personal: "事假", other: "其他" }
  const leave = await prisma.leaveRequest.create({
    data: {
      employeeId: emp.id,
      startDate: args.startDate,
      endDate: args.endDate,
      reason: `[${typeLabel[args.type] ?? args.type}] ${args.reason}`,
      status: "pending",
    },
  })
  return { success: true, data: { id: leave.id, message: `已为${emp.name}提交${typeLabel[args.type] ?? args.type}请假（${args.startDate} ~ ${args.endDate}），等待审批` } }
}

// ─── approve_leave ───────────────────────────────────
async function execApproveLeave(args: Record<string, string>): Promise<ExecResult> {
  const emp = await findEmployeeByName(args.employeeName)
  if (!emp) return { success: false, error: `找不到员工「${args.employeeName}」` }
  const leave = await prisma.leaveRequest.findFirst({
    where: { employeeId: emp.id, status: "pending" },
    orderBy: { createdAt: "desc" },
  })
  if (!leave) return { success: false, error: `${emp.name}没有待审批的请假申请` }
  const newStatus = args.action === "approve" ? "approved" : "rejected"
  await prisma.leaveRequest.update({ where: { id: leave.id }, data: { status: newStatus } })
  return {
    success: true,
    data: {
      message: `已${newStatus === "approved" ? "批准" : "驳回"}${emp.name}的请假（${leave.startDate} ~ ${leave.endDate}）`,
    },
  }
}

// ─── create_schedule ─────────────────────────────────
async function execCreateSchedule(args: Record<string, string>): Promise<ExecResult> {
  const emp = await findEmployeeByName(args.employeeName)
  if (!emp) return { success: false, error: `找不到员工「${args.employeeName}」` }
  const shift = await findShiftByName(args.shiftName, emp.teamId)
  if (!shift) return { success: false, error: `找不到班次「${args.shiftName}」` }
  const schedule = await prisma.schedule.create({
    data: {
      employeeId: emp.id,
      teamId: emp.teamId,
      shiftId: shift.id,
      shiftDate: args.date,
      status: "scheduled",
    },
  })
  return {
    success: true,
    data: { id: schedule.id, message: `已为${emp.name}在${args.date}安排「${shift.name}」` },
  }
}

// ─── view_attendance ─────────────────────────────────
async function execViewAttendance(args: Record<string, string>): Promise<ExecResult> {
  const [year, month] = args.month.split("-").map(Number)
  const from = `${year}-${String(month).padStart(2, "0")}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2, "0")}-${lastDay}`
  const where: Record<string, unknown> = { date: { gte: from, lte: to } }

  if (args.employeeName) {
    const emp = await findEmployeeByName(args.employeeName)
    if (!emp) return { success: false, error: `找不到员工「${args.employeeName}」` }
    where.employeeId = emp.id
  }
  if (args.teamName) {
    const team = await findTeamByName(args.teamName)
    if (!team) return { success: false, error: `找不到班组「${args.teamName}」` }
    const teamEmps = await prisma.employee.findMany({ where: { teamId: team.id }, select: { id: true } })
    where.employeeId = { in: teamEmps.map((e: { id: string }) => e.id) }
  }

  const records = await prisma.attendanceRecord.findMany({
    where,
    include: { employee: true },
    orderBy: { date: "asc" },
    take: 100,
  })
  type AR = typeof records[number]
  const summary = {
    total: records.length,
    normal: records.filter((r: AR) => r.status === "normal").length,
    late: records.filter((r: AR) => r.status === "late").length,
    absent: records.filter((r: AR) => r.status === "absent").length,
    earlyLeave: records.filter((r: AR) => r.status === "early_leave").length,
  }
  return { success: true, data: { month: args.month, summary } }
}

// ─── export_schedule ─────────────────────────────────
async function execExportSchedule(args: Record<string, string>): Promise<ExecResult> {
  const params = new URLSearchParams({ from: args.from, to: args.to })
  if (args.teamName) {
    const team = await findTeamByName(args.teamName)
    if (team) params.set("teamId", team.id)
  }
  return {
    success: true,
    data: {
      message: "请点击下方链接下载排班 Excel",
      downloadUrl: `/api/export/schedules?${params.toString()}`,
    },
  }
}

// ─── view_leave_gaps ─────────────────────────────────
async function execViewLeaveGaps(args: Record<string, string>): Promise<ExecResult> {
  const params = new URLSearchParams({ from: args.from, to: args.to })
  if (args.teamName) {
    const team = await findTeamByName(args.teamName)
    if (team) params.set("teamId", team.id)
  }
  const res = await fetch(`${getBaseUrl()}/api/leaves/gaps?${params}`)
  if (!res.ok) return { success: false, error: "查询缺口失败" }
  const data = await res.json()
  return { success: true, data }
}

// ─── view_attendance_alerts ──────────────────────────
async function execViewAttendanceAlerts(args: Record<string, string>): Promise<ExecResult> {
  const params = new URLSearchParams({ month: args.month })
  if (args.teamName) {
    const team = await findTeamByName(args.teamName)
    if (team) params.set("teamId", team.id)
  }
  const res = await fetch(`${getBaseUrl()}/api/attendance/alerts?${params}`)
  if (!res.ok) return { success: false, error: "查询出勤异常失败" }
  const data = await res.json()
  return { success: true, data }
}

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
}

// ─── 路由分发 ────────────────────────────────────────
const handlers: Record<string, (args: Record<string, string>) => Promise<ExecResult>> = {
  view_schedule: execViewSchedule,
  create_leave: execCreateLeave,
  approve_leave: execApproveLeave,
  create_schedule: execCreateSchedule,
  view_attendance: execViewAttendance,
  export_schedule: execExportSchedule,
  view_leave_gaps: execViewLeaveGaps,
  view_attendance_alerts: execViewAttendanceAlerts,
}

export async function executeFunction(name: string, args: Record<string, string>): Promise<string> {
  const handler = handlers[name]
  if (!handler) return JSON.stringify({ success: false, error: `未知操作: ${name}` })
  try {
    const result = await handler(args)
    return JSON.stringify(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "执行出错"
    return JSON.stringify({ success: false, error: message })
  }
}
