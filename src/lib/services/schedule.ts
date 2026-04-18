import { scheduleRepo } from "@/lib/repos/schedule"
import { employeeRepo } from "@/lib/repos/employee"
import { shiftRepo } from "@/lib/repos/shift"
import type { CreateScheduleInput, UpdateScheduleInput, ScheduleQuery } from "@/lib/validation/schedule"

export const scheduleService = {
  list(query: ScheduleQuery) {
    return scheduleRepo.findAll(query)
  },

  getById(id: string) {
    return scheduleRepo.findById(id)
  },

  async create(data: CreateScheduleInput) {
    const employee = await employeeRepo.findById(data.employeeId)
    if (!employee) throw new Error("员工不存在")
    if (employee.teamId !== data.teamId) {
      throw new Error("员工不属于该班组")
    }

    const shift = await shiftRepo.findById(data.shiftId)
    if (!shift) throw new Error("班次不存在")

    const dup = await scheduleRepo.findDuplicate(data.employeeId, data.shiftDate, data.shiftId)
    if (dup) throw new Error("该员工在同一天已有相同班次排班")

    return scheduleRepo.create(data)
  },

  async update(id: string, data: UpdateScheduleInput) {
    const existing = await scheduleRepo.findById(id)
    if (!existing) throw new Error("排班记录不存在")

    if (data.shiftId) {
      const shift = await shiftRepo.findById(data.shiftId)
      if (!shift) throw new Error("班次不存在")
      const dup = await scheduleRepo.findDuplicate(
        existing.employeeId,
        existing.shiftDate,
        data.shiftId,
        id,
      )
      if (dup) throw new Error("该员工在同一天已有相同班次排班")
    }

    return scheduleRepo.update(id, data)
  },

  delete(id: string) {
    return scheduleRepo.delete(id)
  },

  async bulkCreate(items: CreateScheduleInput[]) {
    return scheduleRepo.createMany(items)
  },
}
