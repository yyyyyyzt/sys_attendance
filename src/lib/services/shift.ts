import { shiftRepo } from "@/lib/repos/shift"
import { teamRepo } from "@/lib/repos/team"
import type { CreateShiftInput, UpdateShiftInput } from "@/lib/validation/shift"

export const shiftService = {
  list(teamId?: string) {
    return shiftRepo.findAll(teamId)
  },

  getById(id: string) {
    return shiftRepo.findById(id)
  },

  async create(data: CreateShiftInput) {
    const team = await teamRepo.findById(data.teamId)
    if (!team) throw new Error("所选班组不存在")
    return shiftRepo.create(data)
  },

  async update(id: string, data: UpdateShiftInput) {
    if (data.teamId) {
      const team = await teamRepo.findById(data.teamId)
      if (!team) throw new Error("所选班组不存在")
    }
    return shiftRepo.update(id, data)
  },

  delete(id: string) {
    return shiftRepo.delete(id)
  },
}
