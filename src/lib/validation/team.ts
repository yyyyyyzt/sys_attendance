import { z } from "zod"

export const createTeamSchema = z.object({
  name: z.string().min(1, "班组名称不能为空"),
  description: z.string().optional(),
  departmentId: z.string().uuid("部门ID格式不正确").optional(),
  leaveThreshold: z.number().int().min(0).optional(),
})

export const updateTeamSchema = z.object({
  name: z.string().min(1, "班组名称不能为空").optional(),
  description: z.string().optional(),
  departmentId: z.string().uuid("部门ID格式不正确").nullable().optional(),
  leaveThreshold: z.number().int().min(0).optional(),
})

export type CreateTeamInput = z.infer<typeof createTeamSchema>
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>
