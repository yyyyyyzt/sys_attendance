import { z } from "zod"

export const createEmployeeSchema = z.object({
  name: z.string().min(1, "员工姓名不能为空"),
  teamId: z.string().uuid("班组ID格式不正确"),
  position: z.string().min(1, "岗位不能为空"),
  skills: z.array(z.string()).default([]),
  status: z.enum(["active", "inactive"]).default("active"),
})

export const updateEmployeeSchema = z.object({
  name: z.string().min(1, "员工姓名不能为空").optional(),
  teamId: z.string().uuid("班组ID格式不正确").optional(),
  position: z.string().min(1, "岗位不能为空").optional(),
  skills: z.array(z.string()).optional(),
  status: z.enum(["active", "inactive"]).optional(),
})

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>
