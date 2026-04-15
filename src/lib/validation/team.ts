import { z } from "zod"

export const createTeamSchema = z.object({
  name: z.string().min(1, "班组名称不能为空"),
  description: z.string().optional(),
})

export const updateTeamSchema = z.object({
  name: z.string().min(1, "班组名称不能为空").optional(),
  description: z.string().optional(),
})

export type CreateTeamInput = z.infer<typeof createTeamSchema>
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>
