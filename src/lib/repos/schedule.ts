import { randomUUID } from "crypto"
import { queryRows, queryOne, execute } from "@/lib/db"
import type { CreateScheduleInput, UpdateScheduleInput, ScheduleQuery } from "@/lib/validation/schedule"
import type { RowDataPacket } from "mysql2"

type SchedJoinRow = RowDataPacket & {
  id: string
  employeeId: string
  teamId: string
  shiftId: string
  shiftDate: string
  status: string
  note: string | null
  createdAt: Date
  updatedAt: Date
  emp_id: string
  emp_name: string
  emp_position: string
  team_id: string
  team_name: string
  shift_id: string
  shift_code: string
  shift_name: string
  shift_startTime: string
  shift_endTime: string
}

function mapSchedule(r: SchedJoinRow) {
  return {
    id: r.id,
    employeeId: r.employeeId,
    teamId: r.teamId,
    shiftId: r.shiftId,
    shiftDate: r.shiftDate,
    status: r.status,
    note: r.note,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    employee: { id: r.emp_id, name: r.emp_name, position: r.emp_position },
    team: { id: r.team_id, name: r.team_name },
    shift: {
      id: r.shift_id,
      code: r.shift_code,
      name: r.shift_name,
      startTime: r.shift_startTime,
      endTime: r.shift_endTime,
    },
  }
}

const baseJoin = `
  FROM \`Schedule\` s
  INNER JOIN \`Employee\` e ON e.\`id\` = s.\`employeeId\`
  INNER JOIN \`Team\` t ON t.\`id\` = s.\`teamId\`
  INNER JOIN \`Shift\` sh ON sh.\`id\` = s.\`shiftId\`
`

const baseSelect = `
  SELECT s.*,
    e.\`id\` AS emp_id, e.\`name\` AS emp_name, e.\`position\` AS emp_position,
    t.\`id\` AS team_id, t.\`name\` AS team_name,
    sh.\`id\` AS shift_id, sh.\`code\` AS shift_code, sh.\`name\` AS shift_name,
    sh.\`startTime\` AS shift_startTime, sh.\`endTime\` AS shift_endTime
`

export const scheduleRepo = {
  async findAll(query: ScheduleQuery) {
    const cond: string[] = ["1=1"]
    const params: unknown[] = []
    if (query.teamId) {
      cond.push("s.`teamId` = ?")
      params.push(query.teamId)
    }
    if (query.employeeId) {
      cond.push("s.`employeeId` = ?")
      params.push(query.employeeId)
    }
    if (query.from) {
      cond.push("s.`shiftDate` >= ?")
      params.push(query.from)
    }
    if (query.to) {
      cond.push("s.`shiftDate` <= ?")
      params.push(query.to)
    }
    const sql = `${baseSelect} ${baseJoin} WHERE ${cond.join(" AND ")} ORDER BY s.\`shiftDate\` ASC, s.\`createdAt\` ASC`
    const rows = await queryRows<SchedJoinRow>(sql, params)
    return rows.map(mapSchedule)
  },

  async findById(id: string) {
    const r = await queryOne<SchedJoinRow>(
      `${baseSelect} ${baseJoin} WHERE s.\`id\` = ? LIMIT 1`,
      [id],
    )
    return r ? mapSchedule(r) : null
  },

  async findDuplicate(employeeId: string, shiftDate: string, shiftId: string, excludeId?: string) {
    const cond = excludeId
      ? "WHERE s.`employeeId` = ? AND s.`shiftDate` = ? AND s.`shiftId` = ? AND s.`id` <> ?"
      : "WHERE s.`employeeId` = ? AND s.`shiftDate` = ? AND s.`shiftId` = ?"
    const params = excludeId
      ? [employeeId, shiftDate, shiftId, excludeId]
      : [employeeId, shiftDate, shiftId]
    const r = await queryOne<SchedJoinRow>(`${baseSelect} ${baseJoin} ${cond} LIMIT 1`, params)
    return r ? mapSchedule(r) : null
  },

  async create(data: CreateScheduleInput) {
    const id = randomUUID()
    await execute(
      `
      INSERT INTO \`Schedule\` (\`id\`, \`employeeId\`, \`teamId\`, \`shiftId\`, \`shiftDate\`, \`status\`, \`note\`, \`createdAt\`, \`updatedAt\`)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))
    `,
      [id, data.employeeId, data.teamId, data.shiftId, data.shiftDate, data.status, data.note ?? null],
    )
    return this.findById(id)
  },

  async createMany(data: CreateScheduleInput[]) {
    if (data.length === 0) return { count: 0 }
    let count = 0
    for (const row of data) {
      await this.create(row)
      count += 1
    }
    return { count }
  },

  async update(id: string, data: UpdateScheduleInput) {
    const sets: string[] = ["`updatedAt` = NOW(3)"]
    const params: unknown[] = []
    if (data.shiftId !== undefined) {
      sets.push("`shiftId` = ?")
      params.push(data.shiftId)
    }
    if (data.status !== undefined) {
      sets.push("`status` = ?")
      params.push(data.status)
    }
    if (data.note !== undefined) {
      sets.push("`note` = ?")
      params.push(data.note)
    }
    params.push(id)
    await execute(`UPDATE \`Schedule\` SET ${sets.join(", ")} WHERE \`id\` = ?`, params)
    return this.findById(id)
  },

  delete(id: string) {
    return execute("DELETE FROM `Schedule` WHERE `id` = ?", [id])
  },
}
