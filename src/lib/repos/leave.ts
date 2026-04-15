import { prisma } from "@/lib/db"
import { stringArrayToJson } from "@/lib/json-array"
import type { CreateLeaveInput, LeaveQuery } from "@/lib/validation/leave"

export const leaveRepo = {
  findAll(query: LeaveQuery) {
    const where: Record<string, unknown> = {}
    if (query.employeeId) where.employeeId = query.employeeId
    if (query.status) where.status = query.status
    if (query.from || query.to) {
      where.startDate = {
        ...(query.from ? { gte: query.from } : {}),
        ...(query.to ? { lte: query.to } : {}),
      }
    }
    return prisma.leaveRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        employee: { select: { id: true, name: true, position: true, teamId: true } },
      },
    })
  },

  findById(id: string) {
    return prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, name: true, position: true, teamId: true } },
      },
    })
  },

  create(data: CreateLeaveInput) {
    return prisma.leaveRequest.create({
      data: {
        employeeId: data.employeeId,
        startDate: data.startDate,
        endDate: data.endDate,
        shiftIds: stringArrayToJson(data.shiftIds),
        reason: data.reason,
        status: "pending",
      },
    })
  },

  approve(id: string, status: "approved" | "rejected", approverId: string) {
    return prisma.leaveRequest.update({
      where: { id },
      data: { status, approverId },
    })
  },

  delete(id: string) {
    return prisma.leaveRequest.delete({ where: { id } })
  },
}
