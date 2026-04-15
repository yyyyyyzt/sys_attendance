import { z } from "zod"

const datePattern = /^\d{4}-\d{2}-\d{2}$/

export const createScheduleSchema = z.object({
  employeeId: z.string().uuid("员工ID格式不正确"),
  teamId: z.string().uuid("班组ID格式不正确"),
  shiftId: z.string().uuid("班次ID格式不正确"),
  shiftDate: z.string().regex(datePattern, "日期格式需为 YYYY-MM-DD"),
  status: z.enum(["scheduled", "leave", "cancelled", "completed"]).default("scheduled"),
  note: z.string().optional(),
})

export const updateScheduleSchema = z.object({
  shiftId: z.string().uuid("班次ID格式不正确").optional(),
  status: z.enum(["scheduled", "leave", "cancelled", "completed"]).optional(),
  note: z.string().optional(),
})

export const scheduleQuerySchema = z.object({
  teamId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
  from: z.string().regex(datePattern, "日期格式需为 YYYY-MM-DD").optional(),
  to: z.string().regex(datePattern, "日期格式需为 YYYY-MM-DD").optional(),
})

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>
export type ScheduleQuery = z.infer<typeof scheduleQuerySchema>
