import { prisma } from "@/lib/db"
import { stringArrayToJson } from "@/lib/json-array"
import type { CreateEmployeeInput, UpdateEmployeeInput } from "@/lib/validation/employee"

export const employeeRepo = {
  findAll(teamId?: string) {
    return prisma.employee.findMany({
      where: teamId ? { teamId } : undefined,
      orderBy: { createdAt: "desc" },
      include: { team: { select: { id: true, name: true } } },
    })
  },

  findById(id: string) {
    return prisma.employee.findUnique({
      where: { id },
      include: { team: { select: { id: true, name: true } } },
    })
  },

  create(data: CreateEmployeeInput) {
    return prisma.employee.create({
      data: {
        name: data.name,
        teamId: data.teamId,
        position: data.position,
        skills: stringArrayToJson(data.skills),
        status: data.status,
      },
    })
  },

  update(id: string, data: UpdateEmployeeInput) {
    return prisma.employee.update({
      where: { id },
      data: {
        ...data,
        skills: data.skills ? stringArrayToJson(data.skills) : undefined,
      },
    })
  },

  delete(id: string) {
    return prisma.employee.delete({ where: { id } })
  },
}
