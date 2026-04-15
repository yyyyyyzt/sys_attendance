import { prisma } from "@/lib/db"
import type { CreateScheduleInput, UpdateScheduleInput, ScheduleQuery } from "@/lib/validation/schedule"

export const scheduleRepo = {
  findAll(query: ScheduleQuery) {
    const where: Record<string, unknown> = {}
    if (query.teamId) where.teamId = query.teamId
    if (query.employeeId) where.employeeId = query.employeeId
    if (query.from || query.to) {
      where.shiftDate = {
        ...(query.from ? { gte: query.from } : {}),
        ...(query.to ? { lte: query.to } : {}),
      }
    }
    return prisma.schedule.findMany({
      where,
      orderBy: [{ shiftDate: "asc" }, { createdAt: "asc" }],
      include: {
        employee: { select: { id: true, name: true, position: true } },
        team: { select: { id: true, name: true } },
        shift: { select: { id: true, name: true, startTime: true, endTime: true } },
      },
    })
  },

  findById(id: string) {
    return prisma.schedule.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, name: true, position: true } },
        team: { select: { id: true, name: true } },
        shift: { select: { id: true, name: true, startTime: true, endTime: true } },
      },
    })
  },

  /** 查找同一员工同一日同一班次的排班 */
  findDuplicate(employeeId: string, shiftDate: string, shiftId: string, excludeId?: string) {
    return prisma.schedule.findFirst({
      where: {
        employeeId,
        shiftDate,
        shiftId,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    })
  },

  create(data: CreateScheduleInput) {
    return prisma.schedule.create({ data })
  },

  createMany(data: CreateScheduleInput[]) {
    return prisma.schedule.createMany({ data })
  },

  update(id: string, data: UpdateScheduleInput) {
    return prisma.schedule.update({ where: { id }, data })
  },

  delete(id: string) {
    return prisma.schedule.delete({ where: { id } })
  },
}
