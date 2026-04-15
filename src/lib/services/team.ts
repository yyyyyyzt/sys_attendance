import { teamRepo } from "@/lib/repos/team"
import type { CreateTeamInput, UpdateTeamInput } from "@/lib/validation/team"

export const teamService = {
  list() {
    return teamRepo.findAll()
  },

  getById(id: string) {
    return teamRepo.findById(id)
  },

  create(data: CreateTeamInput) {
    return teamRepo.create(data)
  },

  update(id: string, data: UpdateTeamInput) {
    return teamRepo.update(id, data)
  },

  async delete(id: string) {
    const hasEmployees = await teamRepo.hasEmployees(id)
    if (hasEmployees) {
      throw new Error("该班组下仍有员工，无法删除")
    }
    return teamRepo.delete(id)
  },
}
