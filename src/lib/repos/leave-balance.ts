import { randomUUID } from "crypto"
import { queryRows, queryOne, execute } from "@/lib/db"
import type { LeaveType } from "@/lib/types/leave"
import type { RowDataPacket } from "mysql2"

type BalanceRow = RowDataPacket & {
  id: string
  employeeId: string
  year: number
  leaveType: LeaveType
  totalHours: string | number
  remainingHours: string | number
  createdAt: Date
  updatedAt: Date
}

export interface LeaveBalance {
  id: string
  employeeId: string
  year: number
  leaveType: LeaveType
  totalHours: number
  remainingHours: number
}

function mapBalance(r: BalanceRow): LeaveBalance {
  return {
    id: r.id,
    employeeId: r.employeeId,
    year: r.year,
    leaveType: r.leaveType,
    totalHours: Number(r.totalHours),
    remainingHours: Number(r.remainingHours),
  }
}

export const leaveBalanceRepo = {
  async findByEmployee(employeeId: string, year?: number): Promise<LeaveBalance[]> {
    const sql = year
      ? "SELECT * FROM `LeaveBalanceAccount` WHERE `employeeId` = ? AND `year` = ? ORDER BY `leaveType` ASC"
      : "SELECT * FROM `LeaveBalanceAccount` WHERE `employeeId` = ? ORDER BY `year` DESC, `leaveType` ASC"
    const rows = await queryRows<BalanceRow>(sql, year ? [employeeId, year] : [employeeId])
    return rows.map(mapBalance)
  },

  async findOne(employeeId: string, year: number, leaveType: LeaveType): Promise<LeaveBalance | null> {
    const r = await queryOne<BalanceRow>(
      "SELECT * FROM `LeaveBalanceAccount` WHERE `employeeId` = ? AND `year` = ? AND `leaveType` = ? LIMIT 1",
      [employeeId, year, leaveType],
    )
    return r ? mapBalance(r) : null
  },

  async upsert(params: {
    employeeId: string
    year: number
    leaveType: LeaveType
    totalHours: number
    remainingHours?: number
  }): Promise<LeaveBalance> {
    const existing = await this.findOne(params.employeeId, params.year, params.leaveType)
    if (existing) {
      await execute(
        "UPDATE `LeaveBalanceAccount` SET `totalHours` = ?, `remainingHours` = ?, `updatedAt` = NOW(3) WHERE `id` = ?",
        [params.totalHours, params.remainingHours ?? params.totalHours, existing.id],
      )
      const reread = await this.findOne(params.employeeId, params.year, params.leaveType)
      if (!reread) throw new Error("假期账户更新异常")
      return reread
    }
    const id = randomUUID()
    await execute(
      `INSERT INTO \`LeaveBalanceAccount\`
         (\`id\`, \`employeeId\`, \`year\`, \`leaveType\`, \`totalHours\`, \`remainingHours\`, \`createdAt\`, \`updatedAt\`)
       VALUES (?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
      [
        id,
        params.employeeId,
        params.year,
        params.leaveType,
        params.totalHours,
        params.remainingHours ?? params.totalHours,
      ],
    )
    const created = await this.findOne(params.employeeId, params.year, params.leaveType)
    if (!created) throw new Error("假期账户创建失败")
    return created
  },

  /** 扣减剩余小时数；失败时抛出 */
  async deduct(employeeId: string, year: number, leaveType: LeaveType, hours: number): Promise<void> {
    const res = await execute(
      `UPDATE \`LeaveBalanceAccount\`
       SET \`remainingHours\` = \`remainingHours\` - ?, \`updatedAt\` = NOW(3)
       WHERE \`employeeId\` = ? AND \`year\` = ? AND \`leaveType\` = ? AND \`remainingHours\` >= ?`,
      [hours, employeeId, year, leaveType, hours],
    )
    if (res.affectedRows === 0) {
      throw new Error("假期余额不足，无法扣减")
    }
  },

  /** 回滚（撤销审批或撤销请假时调用） */
  async refund(employeeId: string, year: number, leaveType: LeaveType, hours: number): Promise<void> {
    await execute(
      `UPDATE \`LeaveBalanceAccount\`
       SET \`remainingHours\` = LEAST(\`totalHours\`, \`remainingHours\` + ?),
           \`updatedAt\` = NOW(3)
       WHERE \`employeeId\` = ? AND \`year\` = ? AND \`leaveType\` = ?`,
      [hours, employeeId, year, leaveType],
    )
  },
}
