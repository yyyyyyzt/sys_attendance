import { prisma } from "@/lib/db"
import type { CreateShiftInput, UpdateShiftInput } from "@/lib/validation/shift"

export const shiftRepo = {
  findAll(teamId?: string) {
    return prisma.shift.findMany({
      where: teamId ? { teamId } : undefined,
      orderBy: { createdAt: "desc" },
      include: { team: { select: { id: true, name: true } } },
    })
  },

  findById(id: string) {
    return prisma.shift.findUnique({
      where: { id },
      include: { team: { select: { id: true, name: true } } },
    })
  },

  create(data: CreateShiftInput) {
    return prisma.shift.create({ data })
  },

  update(id: string, data: UpdateShiftInput) {
    return prisma.shift.update({ where: { id }, data })
  },

  delete(id: string) {
    return prisma.shift.delete({ where: { id } })
  },
}
