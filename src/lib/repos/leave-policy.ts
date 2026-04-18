import { randomUUID } from "crypto"
import { queryRows, queryOne, execute } from "@/lib/db"
import type { LeaveType } from "@/lib/types/leave"
import type { RowDataPacket } from "mysql2"

type PolicyRow = RowDataPacket & {
  id: string
  leaveType: LeaveType
  maxDays: number | null
  isPaid: boolean | number
  requiresProof: boolean | number
  note: string | null
}

export interface LeavePolicy {
  id: string
  leaveType: LeaveType
  maxDays: number | null
  isPaid: boolean
  requiresProof: boolean
  note: string | null
}

function mapPolicy(r: PolicyRow): LeavePolicy {
  return {
    id: r.id,
    leaveType: r.leaveType,
    maxDays: r.maxDays === null ? null : Number(r.maxDays),
    isPaid: Boolean(r.isPaid),
    requiresProof: Boolean(r.requiresProof),
    note: r.note,
  }
}

export const leavePolicyRepo = {
  async findAll(): Promise<LeavePolicy[]> {
    const rows = await queryRows<PolicyRow>(
      "SELECT * FROM `LeavePolicyRule` ORDER BY `leaveType` ASC",
    )
    return rows.map(mapPolicy)
  },

  async findByType(leaveType: LeaveType): Promise<LeavePolicy | null> {
    const r = await queryOne<PolicyRow>(
      "SELECT * FROM `LeavePolicyRule` WHERE `leaveType` = ? LIMIT 1",
      [leaveType],
    )
    return r ? mapPolicy(r) : null
  },

  async upsert(params: {
    leaveType: LeaveType
    maxDays: number | null
    isPaid: boolean
    requiresProof: boolean
    note?: string | null
  }): Promise<LeavePolicy> {
    const existing = await this.findByType(params.leaveType)
    if (existing) {
      await execute(
        `UPDATE \`LeavePolicyRule\`
         SET \`maxDays\` = ?, \`isPaid\` = ?, \`requiresProof\` = ?, \`note\` = ?, \`updatedAt\` = NOW(3)
         WHERE \`id\` = ?`,
        [params.maxDays, params.isPaid, params.requiresProof, params.note ?? null, existing.id],
      )
      const reread = await this.findByType(params.leaveType)
      if (!reread) throw new Error("假期规则更新异常")
      return reread
    }
    const id = randomUUID()
    await execute(
      `INSERT INTO \`LeavePolicyRule\`
         (\`id\`, \`leaveType\`, \`maxDays\`, \`isPaid\`, \`requiresProof\`, \`note\`, \`createdAt\`, \`updatedAt\`)
       VALUES (?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
      [id, params.leaveType, params.maxDays, params.isPaid, params.requiresProof, params.note ?? null],
    )
    const created = await this.findByType(params.leaveType)
    if (!created) throw new Error("假期规则创建失败")
    return created
  },
}
