import { prisma } from "@/lib/db"
import { leaveRepo } from "@/lib/repos/leave"
import { employeeRepo } from "@/lib/repos/employee"
import { jsonToStringArray } from "@/lib/json-array"
import type { CreateLeaveInput, ApproveLeaveInput, LeaveQuery } from "@/lib/validation/leave"

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

    return leaveRepo.create(data)
  },

  /** 审批请假，通过后自动将对应日期范围内的排班标记为 leave */
  async approve(id: string, input: ApproveLeaveInput) {
    const leave = await leaveRepo.findById(id)
    if (!leave) throw new Error("请假记录不存在")
    if (leave.status !== "pending") throw new Error("该请假已被处理，无法重复审批")

    const updated = await leaveRepo.approve(id, input.status, input.approverId)

    if (input.status === "approved") {
      await mapLeaveToSchedules(leave.employeeId, leave.startDate, leave.endDate)
    }

    return updated
  },

  delete(id: string) {
    return leaveRepo.delete(id)
  },

  /** 检测指定日期范围内各班次的人员缺口 */
  async detectGaps(teamId: string, from: string, to: string): Promise<GapInfo[]> {
    const shifts = await prisma.shift.findMany({
      where: { teamId },
      include: { team: { select: { name: true } } },
    })

    const gaps: GapInfo[] = []
    const dates = getDateRange(from, to)

    for (const date of dates) {
      for (const shift of shifts) {
        const scheduledCount = await prisma.schedule.count({
          where: {
            teamId,
            shiftId: shift.id,
            shiftDate: date,
            status: "scheduled",
          },
        })

        if (scheduledCount < shift.requiredCount) {
          gaps.push({
            shiftDate: date,
            shiftId: shift.id,
            shiftName: shift.name,
            teamId,
            teamName: shift.team.name,
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
    const shift = await prisma.shift.findUnique({ where: { id: shiftId } })
    if (!shift) return []

    const allEmployees = await prisma.employee.findMany({
      where: { teamId, status: "active" },
    })

    const busyEmployeeIds = await prisma.schedule.findMany({
      where: {
        teamId,
        shiftDate,
        status: { in: ["scheduled", "completed"] },
      },
      select: { employeeId: true },
    })
    const busySet = new Set(busyEmployeeIds.map((s: { employeeId: string }) => s.employeeId))

    const onLeaveIds = await prisma.leaveRequest.findMany({
      where: {
        status: "approved",
        startDate: { lte: shiftDate },
        endDate: { gte: shiftDate },
      },
      select: { employeeId: true },
    })
    const leaveSet = new Set(onLeaveIds.map((l: { employeeId: string }) => l.employeeId))

    return allEmployees
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
  await prisma.schedule.updateMany({
    where: {
      employeeId,
      shiftDate: { gte: startDate, lte: endDate },
      status: "scheduled",
    },
    data: { status: "leave" },
  })
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
