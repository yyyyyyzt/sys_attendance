import { z } from "zod"

const datePattern = /^\d{4}-\d{2}-\d{2}$/
const timePattern = /^\d{2}:\d{2}$/

export const createAttendanceSchema = z.object({
  employeeId: z.string().uuid("员工ID格式不正确"),
  date: z.string().regex(datePattern, "日期格式需为 YYYY-MM-DD"),
  checkIn: z.string().regex(timePattern, "时间格式需为 HH:mm").optional(),
  checkOut: z.string().regex(timePattern, "时间格式需为 HH:mm").optional(),
  status: z.enum(["normal", "late", "early", "absent"]).default("normal"),
})

export const updateAttendanceSchema = z.object({
  checkIn: z.string().regex(timePattern, "时间格式需为 HH:mm").optional(),
  checkOut: z.string().regex(timePattern, "时间格式需为 HH:mm").optional(),
  status: z.enum(["normal", "late", "early", "absent"]).optional(),
})

export const attendanceQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  teamId: z.string().uuid().optional(),
  from: z.string().regex(datePattern).optional(),
  to: z.string().regex(datePattern).optional(),
  status: z.enum(["normal", "late", "early", "absent"]).optional(),
})

export const monthlyStatsQuerySchema = z.object({
  teamId: z.string().uuid().optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/, "月份格式需为 YYYY-MM"),
})

/** 出勤预警阈值（前端配置，不落库） */
export const alertConfigSchema = z.object({
  lateThreshold: z.number().int().min(0).default(3),
  absentThreshold: z.number().int().min(0).default(1),
  earlyThreshold: z.number().int().min(0).default(3),
})

export type CreateAttendanceInput = z.infer<typeof createAttendanceSchema>
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>
export type AttendanceQuery = z.infer<typeof attendanceQuerySchema>
export type MonthlyStatsQuery = z.infer<typeof monthlyStatsQuerySchema>
export type AlertConfig = z.infer<typeof alertConfigSchema>
