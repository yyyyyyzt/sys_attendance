import { randomUUID } from "crypto"
import { queryRows, queryOne, execute } from "@/lib/db"
import type { CreateAttendanceInput, UpdateAttendanceInput, AttendanceQuery } from "@/lib/validation/attendance"
import type { RowDataPacket } from "mysql2"

type AttRow = RowDataPacket & {
  id: string
  employeeId: string
  date: string
  checkIn: string | null
  checkOut: string | null
  status: string
  createdAt: Date
  emp_id?: string
  emp_name?: string
  emp_position?: string
  emp_teamId?: string
}

function mapAttendance(r: AttRow) {
  const base = {
    id: r.id,
    employeeId: r.employeeId,
    date: r.date,
    checkIn: r.checkIn,
    checkOut: r.checkOut,
    status: r.status,
    createdAt: r.createdAt,
  }
  if (r.emp_id !== undefined) {
    return {
      ...base,
      employee: {
        id: r.emp_id,
        name: r.emp_name ?? "",
        position: r.emp_position ?? "",
        teamId: r.emp_teamId ?? "",
      },
    }
  }
  return base
}

export const attendanceRepo = {
  async findAll(query: AttendanceQuery) {
    const cond: string[] = ["1=1"]
    const params: unknown[] = []
    if (query.employeeId) {
      cond.push("ar.`employeeId` = ?")
      params.push(query.employeeId)
    }
    if (query.status) {
      cond.push("ar.`status` = ?")
      params.push(query.status)
    }
    if (query.from) {
      cond.push("ar.`date` >= ?")
      params.push(query.from)
    }
    if (query.to) {
      cond.push("ar.`date` <= ?")
      params.push(query.to)
    }
    if (query.teamId) {
      cond.push("e.`teamId` = ?")
      params.push(query.teamId)
    }
    const sql = `
      SELECT ar.*, e.\`id\` AS emp_id, e.\`name\` AS emp_name, e.\`position\` AS emp_position, e.\`teamId\` AS emp_teamId
      FROM \`AttendanceRecord\` ar
      INNER JOIN \`Employee\` e ON e.\`id\` = ar.\`employeeId\`
      WHERE ${cond.join(" AND ")}
      ORDER BY ar.\`date\` DESC, ar.\`createdAt\` DESC
    `
    const rows = await queryRows<AttRow>(sql, params)
    return rows.map(mapAttendance)
  },

  async findById(id: string) {
    const r = await queryOne<AttRow>(
      `
      SELECT ar.*, e.\`id\` AS emp_id, e.\`name\` AS emp_name, e.\`position\` AS emp_position, e.\`teamId\` AS emp_teamId
      FROM \`AttendanceRecord\` ar
      INNER JOIN \`Employee\` e ON e.\`id\` = ar.\`employeeId\`
      WHERE ar.\`id\` = ?
      LIMIT 1
    `,
      [id],
    )
    return r ? mapAttendance(r) : null
  },

  async create(data: CreateAttendanceInput) {
    const id = randomUUID()
    await execute(
      `
      INSERT INTO \`AttendanceRecord\` (\`id\`, \`employeeId\`, \`date\`, \`checkIn\`, \`checkOut\`, \`status\`, \`createdAt\`)
      VALUES (?, ?, ?, ?, ?, ?, NOW(3))
    `,
      [id, data.employeeId, data.date, data.checkIn ?? null, data.checkOut ?? null, data.status],
    )
    return this.findById(id)
  },

  async update(id: string, data: UpdateAttendanceInput) {
    const sets: string[] = []
    const params: unknown[] = []
    if (data.checkIn !== undefined) {
      sets.push("`checkIn` = ?")
      params.push(data.checkIn)
    }
    if (data.checkOut !== undefined) {
      sets.push("`checkOut` = ?")
      params.push(data.checkOut)
    }
    if (data.status !== undefined) {
      sets.push("`status` = ?")
      params.push(data.status)
    }
    params.push(id)
    if (sets.length === 0) return this.findById(id)
    await execute(`UPDATE \`AttendanceRecord\` SET ${sets.join(", ")} WHERE \`id\` = ?`, params)
    return this.findById(id)
  },

  delete(id: string) {
    return execute("DELETE FROM `AttendanceRecord` WHERE `id` = ?", [id])
  },

  async findByMonth(month: string, teamId?: string) {
    const from = `${month}-01`
    const lastDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()
    const to = `${month}-${String(lastDay).padStart(2, "0")}`
    const cond = ["ar.`date` >= ?", "ar.`date` <= ?"]
    const params: string[] = [from, to]
    if (teamId) {
      cond.push("e.`teamId` = ?")
      params.push(teamId)
    }
    const sql = `
      SELECT ar.*, e.\`id\` AS emp_id, e.\`name\` AS emp_name, e.\`position\` AS emp_position, e.\`teamId\` AS emp_teamId
      FROM \`AttendanceRecord\` ar
      INNER JOIN \`Employee\` e ON e.\`id\` = ar.\`employeeId\`
      WHERE ${cond.join(" AND ")}
      ORDER BY ar.\`date\` ASC
    `
    const rows = await queryRows<AttRow>(sql, params)
    return rows.map(mapAttendance)
  },
}
