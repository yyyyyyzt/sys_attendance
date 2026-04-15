import { prisma } from "@/lib/db"
import type { CreateTeamInput, UpdateTeamInput } from "@/lib/validation/team"

export const teamRepo = {
  findAll() {
    return prisma.team.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { employees: true } } },
    })
  },

  findById(id: string) {
    return prisma.team.findUnique({
      where: { id },
      include: { _count: { select: { employees: true } } },
    })
  },

  create(data: CreateTeamInput) {
    return prisma.team.create({ data })
  },

  update(id: string, data: UpdateTeamInput) {
    return prisma.team.update({ where: { id }, data })
  },

  delete(id: string) {
    return prisma.team.delete({ where: { id } })
  },

  /** 检查班组下是否有员工 */
  hasEmployees(id: string) {
    return prisma.employee.count({ where: { teamId: id } }).then((c: number) => c > 0)
  },
}
