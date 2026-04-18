import { z } from "zod"
import { LEAVE_TYPES, type LeaveType } from "@/lib/types/leave"

const datePattern = /^\d{4}-\d{2}-\d{2}$/

const leaveTypeSchema = z.enum(LEAVE_TYPES as unknown as [LeaveType, ...LeaveType[]], {
  message: "请假类型无效",
})

export const createLeaveSchema = z.object({
  employeeId: z.string().uuid("员工ID格式不正确"),
  leaveType: leaveTypeSchema,
  startDate: z.string().regex(datePattern, "日期格式需为 YYYY-MM-DD"),
  endDate: z.string().regex(datePattern, "日期格式需为 YYYY-MM-DD"),
  hours: z.number().positive().default(8),
  shiftIds: z.array(z.string().uuid()).default([]),
  reason: z.string().min(1, "请假原因不能为空"),
})

export const approveLeaveSchema = z.object({
  status: z.enum(["approved", "rejected"], { message: "状态只能是 approved 或 rejected" }),
  approverId: z.string().min(1, "审批人不能为空"),
})

export const cancelLeaveSchema = z.object({
  status: z.literal("cancelled"),
})

export const leaveQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  status: z.enum(["pending", "approved", "rejected", "cancelled"]).optional(),
  from: z.string().regex(datePattern).optional(),
  to: z.string().regex(datePattern).optional(),
})

export type CreateLeaveInput = z.infer<typeof createLeaveSchema>
export type ApproveLeaveInput = z.infer<typeof approveLeaveSchema>
export type CancelLeaveInput = z.infer<typeof cancelLeaveSchema>
export type LeaveQuery = z.infer<typeof leaveQuerySchema>
