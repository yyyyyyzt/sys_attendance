import { randomUUID } from "crypto"
import { queryRows, queryOne, execute } from "@/lib/db"
import { stringArrayToJsonValue } from "@/lib/json-array"
import type { CreateLeaveInput, LeaveQuery } from "@/lib/validation/leave"
import type { RowDataPacket } from "mysql2"

type LeaveRow = RowDataPacket & {
  id: string
  employeeId: string
  leaveType: string
  startDate: string
  endDate: string
  hours: string | number
  shiftIds: unknown
  reason: string
  status: string
  approverId: string | null
  cancelledAt: Date | null
  createdAt: Date
  updatedAt: Date
  emp_id: string
  emp_name: string
  emp_position: string
  emp_teamId: string
}

function mapLeave(r: LeaveRow) {
  return {
    id: r.id,
    employeeId: r.employeeId,
    leaveType: r.leaveType,
    startDate: r.startDate,
    endDate: r.endDate,
    hours: r.hours,
    shiftIds: r.shiftIds,
    reason: r.reason,
    status: r.status,
    approverId: r.approverId,
    cancelledAt: r.cancelledAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    employee: {
      id: r.emp_id,
      name: r.emp_name,
      position: r.emp_position,
      teamId: r.emp_teamId,
    },
  }
}

export const leaveRepo = {
  async findAll(query: LeaveQuery) {
    const cond: string[] = ["1=1"]
    const params: unknown[] = []
    if (query.employeeId) {
      cond.push("lr.`employeeId` = ?")
      params.push(query.employeeId)
    }
    if (query.status) {
      cond.push("lr.`status` = ?")
      params.push(query.status)
    }
    if (query.from && query.to) {
      cond.push("lr.`startDate` <= ? AND lr.`endDate` >= ?")
      params.push(query.to, query.from)
    } else if (query.from) {
      cond.push("lr.`endDate` >= ?")
      params.push(query.from)
    } else if (query.to) {
      cond.push("lr.`startDate` <= ?")
      params.push(query.to)
    }
    const sql = `
      SELECT lr.*, e.\`id\` AS emp_id, e.\`name\` AS emp_name, e.\`position\` AS emp_position, e.\`teamId\` AS emp_teamId
      FROM \`LeaveRequest\` lr
      INNER JOIN \`Employee\` e ON e.\`id\` = lr.\`employeeId\`
      WHERE ${cond.join(" AND ")}
      ORDER BY lr.\`createdAt\` DESC
    `
    const rows = await queryRows<LeaveRow>(sql, params)
    return rows.map(mapLeave)
  },

  async findById(id: string) {
    const r = await queryOne<LeaveRow>(
      `
      SELECT lr.*, e.\`id\` AS emp_id, e.\`name\` AS emp_name, e.\`position\` AS emp_position, e.\`teamId\` AS emp_teamId
      FROM \`LeaveRequest\` lr
      INNER JOIN \`Employee\` e ON e.\`id\` = lr.\`employeeId\`
      WHERE lr.\`id\` = ?
      LIMIT 1
    `,
      [id],
    )
    return r ? mapLeave(r) : null
  },

  async create(data: CreateLeaveInput) {
    const id = randomUUID()
    await execute(
      `
      INSERT INTO \`LeaveRequest\` (
        \`id\`, \`employeeId\`, \`leaveType\`, \`startDate\`, \`endDate\`, \`hours\`, \`shiftIds\`, \`reason\`, \`status\`, \`approverId\`, \`cancelledAt\`, \`createdAt\`, \`updatedAt\`
      ) VALUES (?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?, 'pending', NULL, NULL, NOW(3), NOW(3))
    `,
      [
        id,
        data.employeeId,
        data.leaveType,
        data.startDate,
        data.endDate,
        String(data.hours),
        stringArrayToJsonValue(data.shiftIds),
        data.reason,
      ],
    )
    return await this.findById(id)
  },

  async approve(id: string, status: "approved" | "rejected", approverId: string) {
    await execute(
      "UPDATE `LeaveRequest` SET `status` = ?, `approverId` = ?, `cancelledAt` = NULL, `updatedAt` = NOW(3) WHERE `id` = ?",
      [status, approverId, id],
    )
    return await this.findById(id)
  },

  async cancel(id: string) {
    await execute(
      "UPDATE `LeaveRequest` SET `status` = 'cancelled', `cancelledAt` = NOW(3), `updatedAt` = NOW(3) WHERE `id` = ?",
      [id],
    )
    return await this.findById(id)
  },

  delete(id: string) {
    return execute("DELETE FROM `LeaveRequest` WHERE `id` = ?", [id])
  },
}
