import { prisma } from "@/lib/db"
import type { CreateAttendanceInput, UpdateAttendanceInput, AttendanceQuery } from "@/lib/validation/attendance"

export const attendanceRepo = {
  findAll(query: AttendanceQuery) {
    const where: Record<string, unknown> = {}
    if (query.employeeId) where.employeeId = query.employeeId
    if (query.status) where.status = query.status
    if (query.from || query.to) {
      where.date = {
        ...(query.from ? { gte: query.from } : {}),
        ...(query.to ? { lte: query.to } : {}),
      }
    }
    if (query.teamId) {
      where.employee = { teamId: query.teamId }
    }
    return prisma.attendanceRecord.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: {
        employee: { select: { id: true, name: true, position: true, teamId: true } },
      },
    })
  },

  findById(id: string) {
    return prisma.attendanceRecord.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, name: true, position: true, teamId: true } },
      },
    })
  },

  create(data: CreateAttendanceInput) {
    return prisma.attendanceRecord.create({ data })
  },

  update(id: string, data: UpdateAttendanceInput) {
    return prisma.attendanceRecord.update({ where: { id }, data })
  },

  delete(id: string) {
    return prisma.attendanceRecord.delete({ where: { id } })
  },

  /** 按员工+月份聚合查询（返回原始记录，service 层聚合） */
  findByMonth(month: string, teamId?: string) {
    const from = `${month}-01`
    const lastDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()
    const to = `${month}-${String(lastDay).padStart(2, "0")}`
    const where: Record<string, unknown> = {
      date: { gte: from, lte: to },
    }
    if (teamId) {
      where.employee = { teamId }
    }
    return prisma.attendanceRecord.findMany({
      where,
      orderBy: { date: "asc" },
      include: {
        employee: { select: { id: true, name: true, position: true, teamId: true } },
      },
    })
  },
}
