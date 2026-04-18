/**
 * NL 意图执行器
 * 将 LLM Function Call 解析出的函数名和参数，转化为系统内部 service 调用，
 * 返回结构化结果供 LLM 总结回复用户。
 */

import type { RowDataPacket } from "mysql2"
import { queryOne, queryRows } from "@/lib/db"
import { LEAVE_TYPES, type LeaveType } from "@/lib/types/leave"
import { leaveService } from "@/lib/services/leave"
import { leavePolicyService, typeLabel } from "@/lib/services/leave-policy"
import { scheduleRepo } from "@/lib/repos/schedule"
import { attendanceRepo } from "@/lib/repos/attendance"
import { attendanceService } from "@/lib/services/attendance"
import { leaveRepo } from "@/lib/repos/leave"

interface ExecResult {
  success: boolean
  data?: unknown
  error?: string
}

type EmpLite = RowDataPacket & { id: string; name: string; teamId: string }
type TeamLite = RowDataPacket & { id: string; name: string; leaveThreshold: number }
type ShiftLite = RowDataPacket & { id: string; code: string; name: string; startTime: string; endTime: string }
type LeaveLite = RowDataPacket & {
  id: string
  startDate: string
  endDate: string
  leaveType: string
  hours: string | number
  reason: string
}

async function findEmployeeByName(name: string) {
  return queryOne<EmpLite>("SELECT `id`, `name`, `teamId` FROM `Employee` WHERE `name` LIKE ? LIMIT 1", [
    `%${name}%`,
  ])
}

async function findTeamByName(name: string) {
  return queryOne<TeamLite>(
    "SELECT `id`, `name`, `leaveThreshold` FROM `Team` WHERE `name` LIKE ? LIMIT 1",
    [`%${name}%`],
  )
}

/** 全局班次：按名称或代码模糊匹配 */
async function findShiftByName(name: string) {
  return queryOne<ShiftLite>(
    "SELECT `id`, `code`, `name`, `startTime`, `endTime` FROM `Shift` WHERE `name` LIKE ? OR `code` LIKE ? LIMIT 1",
    [`%${name}%`, `%${name}%`],
  )
}

function resolveLeaveType(raw: string): LeaveType {
  const legacy: Record<string, LeaveType> = {
    annual: "ANNUAL",
    sick: "SICK",
    personal: "PERSONAL",
    other: "PERSONAL",
  }
  const k = raw.toLowerCase()
  if (legacy[k]) return legacy[k]
  if ((LEAVE_TYPES as readonly string[]).includes(raw)) return raw as LeaveType
  return "PERSONAL"
}

// ─── view_schedule ───────────────────────────────────
async function execViewSchedule(args: Record<string, string>): Promise<ExecResult> {
  const q: { from?: string; to?: string; employeeId?: string; teamId?: string } = {
    from: args.from,
    to: args.to,
  }
  if (args.employeeName) {
    const emp = await findEmployeeByName(args.employeeName)
    if (!emp) return { success: false, error: `找不到员工「${args.employeeName}」` }
    q.employeeId = emp.id
  }
  if (args.teamName) {
    const team = await findTeamByName(args.teamName)
    if (!team) return { success: false, error: `找不到班组「${args.teamName}」` }
    q.teamId = team.id
  }
  const schedules = await scheduleRepo.findAll(q)
  const sliced = schedules.slice(0, 50)
  const rows = sliced.map((s) => ({
    日期: s.shiftDate,
    员工: s.employee.name,
    班组: s.team.name,
    班次: `${s.shift.code} ${s.shift.name}`,
    时段: `${s.shift.startTime}-${s.shift.endTime}`,
    状态: s.status,
  }))
  return { success: true, data: { total: sliced.length, rows } }
}

// ─── create_leave ────────────────────────────────────
async function execCreateLeave(args: Record<string, string>): Promise<ExecResult> {
  const emp = await findEmployeeByName(args.employeeName)
  if (!emp) return { success: false, error: `找不到员工「${args.employeeName}」` }
  const leaveType = resolveLeaveType(args.type ?? args.leaveType ?? "PERSONAL")
  const hours = args.hours ? Number(args.hours) : 8
  const leave = await leaveService.create({
    employeeId: emp.id,
    leaveType,
    startDate: args.startDate,
    endDate: args.endDate,
    hours: Number.isFinite(hours) && hours > 0 ? hours : 8,
    shiftIds: [],
    reason: args.reason,
  })
  if (!leave) return { success: false, error: "创建请假失败" }
  return {
    success: true,
    data: {
      id: leave.id,
      message: `已为${emp.name}提交${leaveType}请假（${args.startDate} ~ ${args.endDate}），等待审批`,
    },
  }
}

// ─── approve_leave ───────────────────────────────────
async function execApproveLeave(args: Record<string, string>): Promise<ExecResult> {
  const emp = await findEmployeeByName(args.employeeName)
  if (!emp) return { success: false, error: `找不到员工「${args.employeeName}」` }

  const pendings = await queryRows<LeaveLite>(
    "SELECT `id`, `startDate`, `endDate`, `leaveType`, `hours`, `reason` FROM `LeaveRequest` WHERE `employeeId` = ? AND `status` = 'pending' ORDER BY `createdAt` DESC",
    [emp.id],
  )
  if (pendings.length === 0) {
    return { success: false, error: `${emp.name}没有待审批的请假申请` }
  }

  let target: LeaveLite | undefined
  if (args.startDate) {
    target = pendings.find((l) => l.startDate === args.startDate)
    if (!target) {
      return {
        success: false,
        error: `${emp.name}没有起始日期为「${args.startDate}」的待审批请假`,
      }
    }
  } else if (pendings.length === 1) {
    target = pendings[0]
  } else {
    return {
      success: false,
      error: `${emp.name}目前有 ${pendings.length} 条待审批请假，请指定 startDate 精确定位`,
      data: {
        needClarify: true,
        candidates: pendings.map((l) => ({
          id: l.id,
          startDate: l.startDate,
          endDate: l.endDate,
          leaveType: l.leaveType,
          hours: Number(l.hours),
          reason: l.reason,
        })),
      },
    } as ExecResult
  }

  const status = args.action === "approve" ? "approved" : "rejected"
  const approverId = args.approverId?.trim() || "manager"
  await leaveService.approve(target.id, { status, approverId })
  return {
    success: true,
    data: {
      message: `已${status === "approved" ? "批准" : "驳回"}${emp.name}的请假（${target.startDate} ~ ${target.endDate}）`,
    },
  }
}

// ─── create_schedule ─────────────────────────────────
async function execCreateSchedule(args: Record<string, string>): Promise<ExecResult> {
  const emp = await findEmployeeByName(args.employeeName)
  if (!emp) return { success: false, error: `找不到员工「${args.employeeName}」` }
  const shift = await findShiftByName(args.shiftName)
  if (!shift) return { success: false, error: `找不到班次「${args.shiftName}」` }
  const schedule = await scheduleRepo.create({
    employeeId: emp.id,
    teamId: emp.teamId,
    shiftId: shift.id,
    shiftDate: args.date,
    status: "scheduled",
  })
  if (!schedule) return { success: false, error: "创建排班失败" }
  return {
    success: true,
    data: { id: schedule.id, message: `已为${emp.name}在${args.date}安排「${shift.code}」` },
  }
}

// ─── view_attendance ─────────────────────────────────
async function execViewAttendance(args: Record<string, string>): Promise<ExecResult> {
  const [year, month] = args.month.split("-").map(Number)
  const from = `${year}-${String(month).padStart(2, "0")}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`

  let records: Awaited<ReturnType<typeof attendanceRepo.findAll>>
  if (args.employeeName) {
    const emp = await findEmployeeByName(args.employeeName)
    if (!emp) return { success: false, error: `找不到员工「${args.employeeName}」` }
    records = await attendanceRepo.findAll({ from, to, employeeId: emp.id })
  } else if (args.teamName) {
    const team = await findTeamByName(args.teamName)
    if (!team) return { success: false, error: `找不到班组「${args.teamName}」` }
    records = await attendanceRepo.findAll({ from, to, teamId: team.id })
  } else {
    records = await attendanceRepo.findAll({ from, to })
  }
  records = records.slice(0, 100)
  type AR = (typeof records)[number]
  const summary = {
    total: records.length,
    normal: records.filter((r: AR) => r.status === "normal").length,
    late: records.filter((r: AR) => r.status === "late").length,
    absent: records.filter((r: AR) => r.status === "absent").length,
    early: records.filter((r: AR) => r.status === "early").length,
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

// ─── view_leave_panel ────────────────────────────────
async function execViewLeavePanel(args: Record<string, string>): Promise<ExecResult> {
  const emp = await findEmployeeByName(args.employeeName)
  if (!emp) return { success: false, error: `找不到员工「${args.employeeName}」` }
  const year = args.year ? Number(args.year) : new Date().getFullYear()
  if (!Number.isInteger(year)) return { success: false, error: `年份 ${args.year} 无效` }

  const usage = await leavePolicyService.summarizeUsage(emp.id, year)
  const allLeaves = await leaveRepo.findAll({ employeeId: emp.id })
  const history = allLeaves
    .filter((l) => l.startDate.startsWith(String(year)) || l.endDate.startsWith(String(year)))
    .map((l) => ({
      startDate: l.startDate,
      endDate: l.endDate,
      leaveType: typeLabel(l.leaveType as LeaveType),
      hours: Number(l.hours),
      status: l.status,
      reason: l.reason,
    }))

  const rows = usage.map((u) => ({
    类型: typeLabel(u.leaveType),
    年度上限: u.maxDays == null ? "无明确上限" : `${u.maxDays} 天`,
    已用: `${u.usedDaysThisYear} 天`,
    剩余: u.remainingDays == null ? "—" : `${u.remainingDays} 天`,
  }))

  return {
    success: true,
    data: {
      employee: { id: emp.id, name: emp.name, teamId: emp.teamId },
      year,
      summary: rows,
      history,
    },
  }
}

// ─── view_team_day_leaves ────────────────────────────
async function execViewTeamDayLeaves(args: Record<string, string>): Promise<ExecResult> {
  const team = await findTeamByName(args.teamName)
  if (!team) return { success: false, error: `找不到班组「${args.teamName}」` }
  if (!args.date) return { success: false, error: "请提供 date 参数" }

  const params = new URLSearchParams({ teamId: team.id, date: args.date })
  const res = await fetch(`${getBaseUrl()}/api/leaves/day-overview?${params}`)
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    return { success: false, error: errBody?.error ?? "查询失败" }
  }
  const data = await res.json()
  const riskLabel = data.risk === "shortage"
    ? "班次人员不足"
    : data.risk === "tight"
      ? `已达阈值 ${team.leaveThreshold} 人，建议谨慎批假`
      : "在岗充足"
  return { success: true, data: { ...data, riskLabel } }
}

// ─── view_pending_leaves ─────────────────────────────
async function execViewPendingLeaves(args: Record<string, string>): Promise<ExecResult> {
  const params = new URLSearchParams()
  if (args.teamName) {
    const team = await findTeamByName(args.teamName)
    if (!team) return { success: false, error: `找不到班组「${args.teamName}」` }
    params.set("teamId", team.id)
  }
  const url = `${getBaseUrl()}/api/leaves/pending${params.toString() ? `?${params}` : ""}`
  const res = await fetch(url)
  if (!res.ok) return { success: false, error: "查询待审批队列失败" }
  const data = await res.json()
  return { success: true, data }
}

// ─── view_team_day_attendance ────────────────────────
async function execViewTeamDayAttendance(args: Record<string, string>): Promise<ExecResult> {
  const team = await findTeamByName(args.teamName)
  if (!team) return { success: false, error: `找不到班组「${args.teamName}」` }
  if (!args.date) return { success: false, error: "请提供 date 参数" }

  const rows = await attendanceService.deriveDailyAttendance({
    from: args.date,
    to: args.date,
    teamId: team.id,
  })

  const normal = rows.filter((r) => r.status === "normal").length
  const leave = rows.filter((r) => r.status === "leave").length
  const absent = rows.filter((r) => r.status === "absent").length

  return {
    success: true,
    data: {
      team: { id: team.id, name: team.name },
      date: args.date,
      summary: {
        应到: rows.length,
        实到: normal,
        请假: leave,
        缺勤: absent,
        说明: "未接入打卡，以上为基于排班的默认出勤",
      },
      rows: rows.map((r) => ({
        员工: r.employeeName,
        岗位: r.position,
        班次: r.shiftCode ?? "—",
        状态: statusLabel(r.status),
      })),
    },
  }
}

function statusLabel(s: string): string {
  switch (s) {
    case "normal":
      return "出勤"
    case "leave":
      return "请假"
    case "absent":
      return "缺勤"
    case "late":
      return "迟到"
    case "early":
      return "早退"
    default:
      return s
  }
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
  view_leave_panel: execViewLeavePanel,
  view_team_day_leaves: execViewTeamDayLeaves,
  view_pending_leaves: execViewPendingLeaves,
  view_team_day_attendance: execViewTeamDayAttendance,
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
