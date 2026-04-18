import { randomUUID } from "crypto"
import { queryRows, queryOne, execute } from "@/lib/db"
import { stringArrayToJsonValue } from "@/lib/json-array"
import type { CreateEmployeeInput, UpdateEmployeeInput } from "@/lib/validation/employee"
import type { RowDataPacket } from "mysql2"

type EmpRow = RowDataPacket & {
  id: string
  name: string
  teamId: string
  position: string
  skills: unknown
  status: string
  createdAt: Date
  updatedAt: Date
  team_id?: string
  team_name?: string
}

function mapEmployee(r: EmpRow) {
  const base = {
    id: r.id,
    name: r.name,
    teamId: r.teamId,
    position: r.position,
    skills: r.skills,
    status: r.status,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
  if (r.team_id !== undefined) {
    return { ...base, team: { id: r.team_id, name: r.team_name ?? "" } }
  }
  return base
}

export const employeeRepo = {
  async findAll(teamId?: string) {
    const sql = teamId
      ? `
        SELECT e.*, t.\`id\` AS team_id, t.\`name\` AS team_name
        FROM \`Employee\` e
        INNER JOIN \`Team\` t ON t.\`id\` = e.\`teamId\`
        WHERE e.\`teamId\` = ?
        ORDER BY e.\`createdAt\` DESC
      `
      : `
        SELECT e.*, t.\`id\` AS team_id, t.\`name\` AS team_name
        FROM \`Employee\` e
        INNER JOIN \`Team\` t ON t.\`id\` = e.\`teamId\`
        ORDER BY e.\`createdAt\` DESC
      `
    const rows = await queryRows<EmpRow>(sql, teamId ? [teamId] : [])
    return rows.map(mapEmployee)
  },

  async findById(id: string) {
    const r = await queryOne<EmpRow>(
      `
      SELECT e.*, t.\`id\` AS team_id, t.\`name\` AS team_name
      FROM \`Employee\` e
      INNER JOIN \`Team\` t ON t.\`id\` = e.\`teamId\`
      WHERE e.\`id\` = ?
      LIMIT 1
    `,
      [id],
    )
    return r ? mapEmployee(r) : null
  },

  async create(data: CreateEmployeeInput) {
    const id = randomUUID()
    await execute(
      `
      INSERT INTO \`Employee\` (\`id\`, \`name\`, \`teamId\`, \`position\`, \`skills\`, \`status\`, \`createdAt\`, \`updatedAt\`)
      VALUES (?, ?, ?, ?, CAST(? AS JSON), ?, NOW(3), NOW(3))
    `,
      [id, data.name, data.teamId, data.position, stringArrayToJsonValue(data.skills ?? []), data.status],
    )
    return this.findById(id)
  },

  async update(id: string, data: UpdateEmployeeInput) {
    const sets: string[] = ["`updatedAt` = NOW(3)"]
    const params: unknown[] = []
    if (data.name !== undefined) {
      sets.push("`name` = ?")
      params.push(data.name)
    }
    if (data.teamId !== undefined) {
      sets.push("`teamId` = ?")
      params.push(data.teamId)
    }
    if (data.position !== undefined) {
      sets.push("`position` = ?")
      params.push(data.position)
    }
    if (data.skills !== undefined) {
      sets.push("`skills` = CAST(? AS JSON)")
      params.push(stringArrayToJsonValue(data.skills))
    }
    if (data.status !== undefined) {
      sets.push("`status` = ?")
      params.push(data.status)
    }
    params.push(id)
    await execute(`UPDATE \`Employee\` SET ${sets.join(", ")} WHERE \`id\` = ?`, params)
    return this.findById(id)
  },

  delete(id: string) {
    return execute("DELETE FROM `Employee` WHERE `id` = ?", [id])
  },
}
