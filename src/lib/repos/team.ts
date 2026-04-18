import { randomUUID } from "crypto"
import { queryRows, queryOne, execute } from "@/lib/db"
import type { CreateTeamInput, UpdateTeamInput } from "@/lib/validation/team"
import type { RowDataPacket } from "mysql2"

type TeamRow = RowDataPacket & {
  id: string
  name: string
  description: string | null
  departmentId: string | null
  leaveThreshold: number
  createdAt: Date
  employeeCount?: number
}

function mapTeam(r: TeamRow) {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    departmentId: r.departmentId,
    leaveThreshold: r.leaveThreshold,
    createdAt: r.createdAt,
    _count: { employees: Number(r.employeeCount ?? 0) },
  }
}

export const teamRepo = {
  async findAll() {
    const rows = await queryRows<TeamRow>(
      `
      SELECT t.*, (SELECT COUNT(*) FROM \`Employee\` e WHERE e.\`teamId\` = t.\`id\`) AS employeeCount
      FROM \`Team\` t
      ORDER BY t.\`createdAt\` DESC
    `,
    )
    return rows.map(mapTeam)
  },

  async findById(id: string) {
    const r = await queryOne<TeamRow>(
      `
      SELECT t.*, (SELECT COUNT(*) FROM \`Employee\` e WHERE e.\`teamId\` = t.\`id\`) AS employeeCount
      FROM \`Team\` t
      WHERE t.\`id\` = ?
      LIMIT 1
    `,
      [id],
    )
    return r ? mapTeam(r) : null
  },

  async create(data: CreateTeamInput) {
    const id = randomUUID()
    await execute(
      `
      INSERT INTO \`Team\` (\`id\`, \`name\`, \`description\`, \`departmentId\`, \`leaveThreshold\`, \`createdAt\`)
      VALUES (?, ?, ?, ?, ?, NOW(3))
    `,
      [
        id,
        data.name,
        data.description ?? null,
        data.departmentId ?? null,
        data.leaveThreshold ?? 3,
      ],
    )
    return this.findById(id)
  },

  async update(id: string, data: UpdateTeamInput) {
    const sets: string[] = []
    const params: unknown[] = []
    if (data.name !== undefined) {
      sets.push("`name` = ?")
      params.push(data.name)
    }
    if (data.description !== undefined) {
      sets.push("`description` = ?")
      params.push(data.description)
    }
    if (data.departmentId !== undefined) {
      sets.push("`departmentId` = ?")
      params.push(data.departmentId)
    }
    if (data.leaveThreshold !== undefined) {
      sets.push("`leaveThreshold` = ?")
      params.push(data.leaveThreshold)
    }
    params.push(id)
    if (sets.length === 0) return this.findById(id)
    await execute(`UPDATE \`Team\` SET ${sets.join(", ")} WHERE \`id\` = ?`, params)
    return this.findById(id)
  },

  delete(id: string) {
    return execute("DELETE FROM `Team` WHERE `id` = ?", [id])
  },

  async hasEmployees(id: string) {
    const r = await queryOne<RowDataPacket & { c: number }>(
      "SELECT COUNT(*) AS c FROM `Employee` WHERE `teamId` = ?",
      [id],
    )
    return Number(r?.c ?? 0) > 0
  },
}
