import { employeeRepo } from "@/lib/repos/employee"
import { teamRepo } from "@/lib/repos/team"
import type { CreateEmployeeInput, UpdateEmployeeInput } from "@/lib/validation/employee"

export const employeeService = {
  list(teamId?: string) {
    return employeeRepo.findAll(teamId)
  },

  getById(id: string) {
    return employeeRepo.findById(id)
  },

  async create(data: CreateEmployeeInput) {
    const team = await teamRepo.findById(data.teamId)
    if (!team) throw new Error("所选班组不存在")
    return employeeRepo.create(data)
  },

  async update(id: string, data: UpdateEmployeeInput) {
    if (data.teamId) {
      const team = await teamRepo.findById(data.teamId)
      if (!team) throw new Error("所选班组不存在")
    }
    return employeeRepo.update(id, data)
  },

  delete(id: string) {
    return employeeRepo.delete(id)
  },
}
