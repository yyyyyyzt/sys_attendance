import { execute, queryOne, queryRows } from "@/lib/db"
import { leaveRepo } from "@/lib/repos/leave"
import { employeeRepo } from "@/lib/repos/employee"
import { shiftRepo } from "@/lib/repos/shift"
import { teamRepo } from "@/lib/repos/team"
import { leaveBalanceRepo } from "@/lib/repos/leave-balance"
import { leavePolicyService, isConsumptive } from "@/lib/services/leave-policy"
import { jsonToStringArray } from "@/lib/json-array"
import type { CreateLeaveInput, ApproveLeaveInput, LeaveQuery } from "@/lib/validation/leave"
import type { LeaveType } from "@/lib/types/leave"
import type { RowDataPacket } from "mysql2"

export interface GapInfo {
  shiftDate: string
  shiftId: string
  shiftName: string
  teamId: string
  teamName: string
  requiredCount: number
  currentCount: number
  gap: number
}

export interface SubstituteCandidate {
  id: string
  name: string
  position: string
  skills: string[]
}

export const leaveService = {
  list(query: LeaveQuery) {
    return leaveRepo.findAll(query)
  },

  getById(id: string) {
    return leaveRepo.findById(id)
  },

  async create(data: CreateLeaveInput) {
    const employee = await employeeRepo.findById(data.employeeId)
    if (!employee) throw new Error("员工不存在")

    if (data.startDate > data.endDate) {
      throw new Error("开始日期不能晚于结束日期")
    }

    const year = Number(data.startDate.slice(0, 4))
    const eligibility = await leavePolicyService.checkEligibility({
      employeeId: data.employeeId,
      leaveType: data.leaveType,
      hours: Number(data.hours),
      year,
    })
    if (!eligibility.ok) {
      throw new Error(eligibility.reason)
    }

    return leaveRepo.create(data)
  },

  /**
   * 审批请假：
   * - 批准：将对应日期范围内的排班标记为 leave；若是消耗型假期，扣减 LeaveBalanceAccount
   * - 驳回：仅更新状态，不扣假、不动排班
   */
  async approve(id: string, input: ApproveLeaveInput) {
    const leave = await leaveRepo.findById(id)
    if (!leave) throw new Error("请假记录不存在")
    if (leave.status !== "pending") throw new Error("该请假已被处理，无法重复审批")

    if (input.status === "approved") {
      const leaveType = leave.leaveType as LeaveType
      const hours = Number(leave.hours)
      const year = Number(leave.startDate.slice(0, 4))

      const recheck = await leavePolicyService.checkEligibility({
        employeeId: leave.employeeId,
        leaveType,
        hours,
        year,
      })
      if (!recheck.ok) {
        throw new Error(`审批失败：${recheck.reason}`)
      }

      if (isConsumptive(leaveType)) {
        await leavePolicyService.ensureConsumptiveAccount(leave.employeeId, year, leaveType)
        await leaveBalanceRepo.deduct(leave.employeeId, year, leaveType, hours)
      }
    }

    const updated = await leaveRepo.approve(id, input.status, input.approverId)

    if (input.status === "approved") {
      await mapLeaveToSchedules(leave.employeeId, leave.startDate, leave.endDate)
    }

    return updated
  },

  /**
   * 撤销请假。
   * - 若原状态为 approved 且为消耗型 → 回滚余额；排班状态不自动恢复（保留原边界）。
   * - 若原状态为 pending → 仅改状态。
   */
  async cancel(id: string) {
    const leave = await leaveRepo.findById(id)
    if (!leave) throw new Error("请假记录不存在")
    if (leave.status === "cancelled") throw new Error("该请假已撤销")
    if (leave.status === "rejected") throw new Error("已驳回的记录无法撤销")

    if (leave.status === "approved") {
      const leaveType = leave.leaveType as LeaveType
      if (isConsumptive(leaveType)) {
        const year = Number(leave.startDate.slice(0, 4))
        await leaveBalanceRepo.refund(leave.employeeId, year, leaveType, Number(leave.hours))
      }
    }

    return leaveRepo.cancel(id)
  },

  delete(id: string) {
    return leaveRepo.delete(id)
  },

  /** 检测指定日期范围内各全局班次在该班组的人员缺口 */
  async detectGaps(teamId: string, from: string, to: string): Promise<GapInfo[]> {
    const team = await teamRepo.findById(teamId)
    if (!team) return []

    const shifts = await shiftRepo.findAll()
    const gaps: GapInfo[] = []
    const dates = getDateRange(from, to)

    for (const date of dates) {
      for (const shift of shifts) {
        const cntRow = await queryOne<RowDataPacket & { c: number }>(
          `
          SELECT COUNT(*) AS c FROM \`Schedule\`
          WHERE \`teamId\` = ? AND \`shiftId\` = ? AND \`shiftDate\` = ? AND \`status\` = 'scheduled'
        `,
          [teamId, shift.id, date],
        )
        const scheduledCount = Number(cntRow?.c ?? 0)

        if (scheduledCount < shift.requiredCount) {
          gaps.push({
            shiftDate: date,
            shiftId: shift.id,
            shiftName: shift.name,
            teamId,
            teamName: team.name,
            requiredCount: shift.requiredCount,
            currentCount: scheduledCount,
            gap: shift.requiredCount - scheduledCount,
          })
        }
      }
    }

    return gaps
  },

  /** 推荐替补人员：同班组、当日无排班/请假、在职、技能匹配 */
  async recommendSubstitutes(
    teamId: string,
    shiftDate: string,
    shiftId: string,
  ): Promise<SubstituteCandidate[]> {
    const shift = await shiftRepo.findById(shiftId)
    if (!shift) return []

    const allEmployees = await employeeRepo.findAll(teamId)
    const active = allEmployees.filter(
      (e: { status?: string }) => (e as { status: string }).status === "active",
    )

    const busyRows = await queryRows<RowDataPacket & { employeeId: string }>(
      `
      SELECT \`employeeId\` FROM \`Schedule\`
      WHERE \`teamId\` = ? AND \`shiftDate\` = ? AND \`status\` IN ('scheduled', 'completed')
    `,
      [teamId, shiftDate],
    )
    const busySet = new Set(busyRows.map((s) => s.employeeId))

    const leaveRows = await queryRows<RowDataPacket & { employeeId: string }>(
      `
      SELECT \`employeeId\` FROM \`LeaveRequest\`
      WHERE \`status\` = 'approved' AND \`startDate\` <= ? AND \`endDate\` >= ?
    `,
      [shiftDate, shiftDate],
    )
    const leaveSet = new Set(leaveRows.map((l) => l.employeeId))

    return active
      .filter((e: { id: string }) => !busySet.has(e.id) && !leaveSet.has(e.id))
      .map((e: { id: string; name: string; position: string; skills: unknown }) => ({
        id: e.id,
        name: e.name,
        position: e.position,
        skills: jsonToStringArray(e.skills),
      }))
  },
}

/** 将请假期间的已排班记录标记为 leave */
async function mapLeaveToSchedules(employeeId: string, startDate: string, endDate: string) {
  await execute(
    `
    UPDATE \`Schedule\`
    SET \`status\` = 'leave', \`updatedAt\` = NOW(3)
    WHERE \`employeeId\` = ? AND \`shiftDate\` >= ? AND \`shiftDate\` <= ? AND \`status\` = 'scheduled'
  `,
    [employeeId, startDate, endDate],
  )
}

function getDateRange(from: string, to: string): string[] {
  const dates: string[] = []
  const start = new Date(from)
  const end = new Date(to)
  const current = new Date(start)
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10))
    current.setDate(current.getDate() + 1)
  }
  return dates
}
