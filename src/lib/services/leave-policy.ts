import { queryRows, queryOne } from "@/lib/db"
import { leaveBalanceRepo, type LeaveBalance } from "@/lib/repos/leave-balance"
import { leavePolicyRepo, type LeavePolicy } from "@/lib/repos/leave-policy"
import type { LeaveType } from "@/lib/types/leave"
import type { RowDataPacket } from "mysql2"

/** 消耗型：按 LeaveBalanceAccount 扣减 */
export const CONSUMPTIVE_LEAVE_TYPES = ["ANNUAL", "MARRIAGE", "CHILD_CARE"] as const
export type ConsumptiveLeaveType = (typeof CONSUMPTIVE_LEAVE_TYPES)[number]

/** 上限型：不预发余额，但单次/年度累计不得超过 policy.maxDays */
export const CAPPED_LEAVE_TYPES = [
  "BEREAVEMENT",
  "PATERNITY",
  "NURSING",
  "SICK",
  "PERSONAL",
] as const
export type CappedLeaveType = (typeof CAPPED_LEAVE_TYPES)[number]

/** 每日工时基准：日=8 小时 */
export const HOURS_PER_DAY = 8

export function isConsumptive(t: LeaveType): t is ConsumptiveLeaveType {
  return (CONSUMPTIVE_LEAVE_TYPES as readonly string[]).includes(t)
}
export function isCapped(t: LeaveType): t is CappedLeaveType {
  return (CAPPED_LEAVE_TYPES as readonly string[]).includes(t)
}

/**
 * 消耗型假期的年度默认额度（单位：小时）。
 *
 * 策略变更：默认额度全部为 0，管理员需在员工假期管理页里手动分配。
 * 这样更贴近实际——年假可能按工龄不同、婚假只有新婚者有、
 * 产假/陪产假仅适用于相应员工等。
 */
export const DEFAULT_CONSUMPTIVE_HOURS: Record<ConsumptiveLeaveType, number> = {
  ANNUAL: 0,
  MARRIAGE: 0,
  CHILD_CARE: 0,
}

export interface EligibilityOk {
  ok: true
  category: "consumptive" | "capped" | "other"
}
export interface EligibilityFail {
  ok: false
  reason: string
  category: "consumptive" | "capped" | "other"
}
export type EligibilityResult = EligibilityOk | EligibilityFail

export interface LeaveUsageSummary {
  leaveType: LeaveType
  usedHoursThisYear: number
  usedDaysThisYear: number
  maxDays: number | null
  maxHours: number | null
  remainingDays: number | null
  remainingHours: number | null
  policy: LeavePolicy | null
  balance: LeaveBalance | null
}

export const leavePolicyService = {
  /** 确保一个员工的消耗型假期账户存在（按 DEFAULT_CONSUMPTIVE_HOURS 初始化）。 */
  async ensureConsumptiveAccount(
    employeeId: string,
    year: number,
    leaveType: ConsumptiveLeaveType,
  ): Promise<LeaveBalance> {
    const existing = await leaveBalanceRepo.findOne(employeeId, year, leaveType)
    if (existing) return existing
    return leaveBalanceRepo.upsert({
      employeeId,
      year,
      leaveType,
      totalHours: DEFAULT_CONSUMPTIVE_HOURS[leaveType],
    })
  },

  /** 查询员工今年已使用（已批准）的某类请假小时数 */
  async sumApprovedHours(employeeId: string, leaveType: LeaveType, year: number): Promise<number> {
    const startOfYear = `${year}-01-01`
    const endOfYear = `${year}-12-31`
    const row = await queryOne<RowDataPacket & { h: string | number | null }>(
      `SELECT COALESCE(SUM(\`hours\`), 0) AS h
       FROM \`LeaveRequest\`
       WHERE \`employeeId\` = ?
         AND \`leaveType\`  = ?
         AND \`status\`     = 'approved'
         AND \`startDate\` <= ?
         AND \`endDate\`   >= ?`,
      [employeeId, leaveType, endOfYear, startOfYear],
    )
    return Number(row?.h ?? 0)
  },

  /** 员工假期面板所需的完整用量汇总 */
  async summarizeUsage(employeeId: string, year: number): Promise<LeaveUsageSummary[]> {
    const policies = await leavePolicyRepo.findAll()
    const policyByType = new Map<LeaveType, LeavePolicy>()
    for (const p of policies) policyByType.set(p.leaveType, p)

    const balances = await leaveBalanceRepo.findByEmployee(employeeId, year)
    const balanceByType = new Map<LeaveType, LeaveBalance>()
    for (const b of balances) balanceByType.set(b.leaveType, b)

    const allTypes: LeaveType[] = [
      ...CONSUMPTIVE_LEAVE_TYPES,
      ...CAPPED_LEAVE_TYPES,
    ]

    const results: LeaveUsageSummary[] = []
    for (const t of allTypes) {
      const usedHours = await this.sumApprovedHours(employeeId, t, year)
      const policy = policyByType.get(t) ?? null
      const balance = balanceByType.get(t) ?? null

      let maxHours: number | null = null
      let remainingHours: number | null = null

      if (isConsumptive(t)) {
        const effectiveTotal = balance?.totalHours ?? DEFAULT_CONSUMPTIVE_HOURS[t as ConsumptiveLeaveType]
        maxHours = effectiveTotal
        remainingHours = balance ? balance.remainingHours : Math.max(0, effectiveTotal - usedHours)
      } else {
        if (balance && balance.totalHours > 0) {
          maxHours = balance.totalHours
        } else if (policy?.maxDays != null) {
          maxHours = policy.maxDays * HOURS_PER_DAY
        }
        if (maxHours != null) {
          remainingHours = Math.max(0, maxHours - usedHours)
        }
      }

      results.push({
        leaveType: t,
        usedHoursThisYear: usedHours,
        usedDaysThisYear: roundTo(usedHours / HOURS_PER_DAY, 2),
        maxDays: maxHours == null ? null : roundTo(maxHours / HOURS_PER_DAY, 2),
        maxHours,
        remainingDays: remainingHours == null ? null : roundTo(remainingHours / HOURS_PER_DAY, 2),
        remainingHours,
        policy,
        balance,
      })
    }
    return results
  },

  /**
   * 校验请假申请是否可受理。
   * - 消耗型：必须有足够 remainingHours（若账户不存在会自动按默认额度开户）
   * - 上限型：政策 maxDays 存在时，年度已用 + 本次 ≤ maxDays
   */
  async checkEligibility(params: {
    employeeId: string
    leaveType: LeaveType
    hours: number
    year?: number
  }): Promise<EligibilityResult> {
    const year = params.year ?? new Date().getFullYear()

    if (isConsumptive(params.leaveType)) {
      const account = await this.ensureConsumptiveAccount(
        params.employeeId,
        year,
        params.leaveType,
      )
      if (account.remainingHours < params.hours) {
        return {
          ok: false,
          category: "consumptive",
          reason: `${typeLabel(params.leaveType)}剩余 ${roundTo(account.remainingHours, 2)} 小时（${roundTo(
            account.remainingHours / HOURS_PER_DAY,
            2,
          )} 天），不足本次申请 ${params.hours} 小时（${roundTo(
            params.hours / HOURS_PER_DAY,
            2,
          )} 天），无法受理`,
        }
      }
      return { ok: true, category: "consumptive" }
    }

    if (isCapped(params.leaveType)) {
      const account = await leaveBalanceRepo.findOne(params.employeeId, year, params.leaveType)
      const policy = await leavePolicyRepo.findByType(params.leaveType)

      // 员工级覆盖优先于 policy 全局默认；两者都没有则视为无上限
      let maxHours: number | null = null
      if (account && account.totalHours > 0) {
        maxHours = account.totalHours
      } else if (policy?.maxDays != null) {
        maxHours = policy.maxDays * HOURS_PER_DAY
      }

      if (maxHours != null) {
        const used = await this.sumApprovedHours(params.employeeId, params.leaveType, year)
        if (used + params.hours > maxHours) {
          return {
            ok: false,
            category: "capped",
            reason: `${typeLabel(params.leaveType)}上限 ${roundTo(maxHours / HOURS_PER_DAY, 2)} 天（${maxHours} 小时），今年已请 ${roundTo(
              used / HOURS_PER_DAY,
              2,
            )} 天，本次 ${roundTo(params.hours / HOURS_PER_DAY, 2)} 天将超上限，无法受理`,
          }
        }
      }
      return { ok: true, category: "capped" }
    }

    return { ok: true, category: "other" }
  },
}

/** 获取员工当年已请某类假期的去重日期列表（用于审计） */
export async function listApprovedLeaveDates(
  employeeId: string,
  leaveType: LeaveType,
  year: number,
): Promise<string[]> {
  type R = RowDataPacket & { startDate: string; endDate: string }
  const rows = await queryRows<R>(
    `SELECT \`startDate\`, \`endDate\` FROM \`LeaveRequest\`
     WHERE \`employeeId\` = ? AND \`leaveType\` = ? AND \`status\` = 'approved'
       AND \`startDate\` <= ? AND \`endDate\` >= ?`,
    [employeeId, leaveType, `${year}-12-31`, `${year}-01-01`],
  )
  const set = new Set<string>()
  for (const r of rows) {
    const start = new Date(r.startDate)
    const end = new Date(r.endDate)
    const cur = new Date(start)
    while (cur <= end) {
      const d = cur.toISOString().slice(0, 10)
      if (d >= `${year}-01-01` && d <= `${year}-12-31`) set.add(d)
      cur.setDate(cur.getDate() + 1)
    }
  }
  return Array.from(set).sort()
}

export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  ANNUAL: "年假",
  CHILD_CARE: "育儿假",
  SICK: "病假",
  PERSONAL: "事假",
  MARRIAGE: "婚假",
  NURSING: "护理假",
  PATERNITY: "陪产假",
  BEREAVEMENT: "丧假",
}

export function typeLabel(t: LeaveType): string {
  return LEAVE_TYPE_LABEL[t] ?? t
}

function roundTo(n: number, digits: number): number {
  const f = 10 ** digits
  return Math.round(n * f) / f
}
