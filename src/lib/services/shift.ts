import { shiftRepo } from "@/lib/repos/shift"
import type { CreateShiftInput, UpdateShiftInput } from "@/lib/validation/shift"

export const shiftService = {
  list() {
    return shiftRepo.findAll()
  },

  getById(id: string) {
    return shiftRepo.findById(id)
  },

  async create(data: CreateShiftInput) {
    const dup = await shiftRepo.findByCode(data.code)
    if (dup) throw new Error("该班次代码已存在")
    return shiftRepo.create(data)
  },

  update(id: string, data: UpdateShiftInput) {
    return shiftRepo.update(id, data)
  },

  delete(id: string) {
    return shiftRepo.delete(id)
  },
}
