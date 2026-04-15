import { z } from "zod"

const timePattern = /^\d{2}:\d{2}$/

export const createShiftSchema = z.object({
  name: z.string().min(1, "班次名称不能为空"),
  startTime: z.string().regex(timePattern, "时间格式需为 HH:mm"),
  endTime: z.string().regex(timePattern, "时间格式需为 HH:mm"),
  isCrossDay: z.boolean().default(false),
  requiredCount: z.number().int().min(1, "最少需要1人"),
  teamId: z.string().uuid("班组ID格式不正确"),
})

export const updateShiftSchema = z.object({
  name: z.string().min(1, "班次名称不能为空").optional(),
  startTime: z.string().regex(timePattern, "时间格式需为 HH:mm").optional(),
  endTime: z.string().regex(timePattern, "时间格式需为 HH:mm").optional(),
  isCrossDay: z.boolean().optional(),
  requiredCount: z.number().int().min(1, "最少需要1人").optional(),
  teamId: z.string().uuid("班组ID格式不正确").optional(),
})

export type CreateShiftInput = z.infer<typeof createShiftSchema>
export type UpdateShiftInput = z.infer<typeof updateShiftSchema>
