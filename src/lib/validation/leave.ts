import { z } from "zod"

const datePattern = /^\d{4}-\d{2}-\d{2}$/

export const createLeaveSchema = z.object({
  employeeId: z.string().uuid("员工ID格式不正确"),
  startDate: z.string().regex(datePattern, "日期格式需为 YYYY-MM-DD"),
  endDate: z.string().regex(datePattern, "日期格式需为 YYYY-MM-DD"),
  shiftIds: z.array(z.string().uuid()).default([]),
  reason: z.string().min(1, "请假原因不能为空"),
})

export const approveLeaveSchema = z.object({
  status: z.enum(["approved", "rejected"], { message: "状态只能是 approved 或 rejected" }),
  approverId: z.string().min(1, "审批人不能为空"),
})

export const leaveQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  from: z.string().regex(datePattern).optional(),
  to: z.string().regex(datePattern).optional(),
})

export type CreateLeaveInput = z.infer<typeof createLeaveSchema>
export type ApproveLeaveInput = z.infer<typeof approveLeaveSchema>
export type LeaveQuery = z.infer<typeof leaveQuerySchema>
