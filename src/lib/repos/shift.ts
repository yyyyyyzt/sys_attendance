import { randomUUID } from "crypto"
import { queryRows, queryOne, execute } from "@/lib/db"
import type { CreateShiftInput, UpdateShiftInput } from "@/lib/validation/shift"
import type { RowDataPacket } from "mysql2"

type ShiftRow = RowDataPacket & {
  id: string
  code: string
  name: string
  startTime: string
  endTime: string
  isCrossNight: boolean
  requiredCount: number
  workMinutes: number
  segmentsJson: unknown
  remark: string | null
  createdAt: Date
}

export const shiftRepo = {
  findAll() {
    return queryRows<ShiftRow>("SELECT * FROM `Shift` ORDER BY `code` ASC")
  },

  findById(id: string) {
    return queryOne<ShiftRow>("SELECT * FROM `Shift` WHERE `id` = ? LIMIT 1", [id])
  },

  findByCode(code: string) {
    return queryOne<ShiftRow>("SELECT * FROM `Shift` WHERE `code` = ? LIMIT 1", [code])
  },

  async create(data: CreateShiftInput) {
    const id = randomUUID()
    await execute(
      `
      INSERT INTO \`Shift\` (\`id\`, \`code\`, \`name\`, \`startTime\`, \`endTime\`, \`isCrossNight\`, \`requiredCount\`, \`workMinutes\`, \`segmentsJson\`, \`remark\`, \`createdAt\`)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?, NOW(3))
    `,
      [
        id,
        data.code,
        data.name,
        data.startTime,
        data.endTime,
        data.isCrossDay,
        data.requiredCount,
        data.workMinutes,
        JSON.stringify(data.segmentsJson ?? []),
        data.remark ?? null,
      ],
    )
    return this.findById(id)
  },

  async update(id: string, data: UpdateShiftInput) {
    const sets: string[] = []
    const params: unknown[] = []
    if (data.code !== undefined) {
      sets.push("`code` = ?")
      params.push(data.code)
    }
    if (data.name !== undefined) {
      sets.push("`name` = ?")
      params.push(data.name)
    }
    if (data.startTime !== undefined) {
      sets.push("`startTime` = ?")
      params.push(data.startTime)
    }
    if (data.endTime !== undefined) {
      sets.push("`endTime` = ?")
      params.push(data.endTime)
    }
    if (data.isCrossDay !== undefined) {
      sets.push("`isCrossNight` = ?")
      params.push(data.isCrossDay)
    }
    if (data.requiredCount !== undefined) {
      sets.push("`requiredCount` = ?")
      params.push(data.requiredCount)
    }
    if (data.workMinutes !== undefined) {
      sets.push("`workMinutes` = ?")
      params.push(data.workMinutes)
    }
    if (data.segmentsJson !== undefined) {
      sets.push("`segmentsJson` = CAST(? AS JSON)")
      params.push(JSON.stringify(data.segmentsJson))
    }
    if (data.remark !== undefined) {
      sets.push("`remark` = ?")
      params.push(data.remark)
    }
    params.push(id)
    if (sets.length === 0) return this.findById(id)
    await execute(`UPDATE \`Shift\` SET ${sets.join(", ")} WHERE \`id\` = ?`, params)
    return this.findById(id)
  },

  delete(id: string) {
    return execute("DELETE FROM `Shift` WHERE `id` = ?", [id])
  },
}
