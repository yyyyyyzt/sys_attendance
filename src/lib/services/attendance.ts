import { attendanceRepo } from "@/lib/repos/attendance"
import { queryRows } from "@/lib/db"
import type {
  CreateAttendanceInput,
  UpdateAttendanceInput,
  AttendanceQuery,
  AlertConfig,
} from "@/lib/validation/attendance"
import type { RowDataPacket } from "mysql2"

export interface EmployeeMonthlyStats {
  employeeId: string
  employeeName: string
  position: string
  teamId: string
  totalDays: number
  normalDays: number
  lateDays: number
  earlyDays: number
  absentDays: number
}

export interface AlertItem {
  employeeId: string
  employeeName: string
  type: "late" | "absent" | "early"
  label: string
  count: number
  threshold: number
}

export interface DerivedAttendance {
  date: string
  employeeId: string
  employeeName: string
  position: string
  teamId: string
  teamName: string
  status: "normal" | "leave" | "absent" | "late" | "early" | "rest"
  shiftCode: string | null
  shiftName: string | null
}

interface DerivedRow extends RowDataPacket {
  date: string
  employeeId: string
  employeeName: string
  position: string
  teamId: string
  teamName: string
  scheduleStatus: string
  shiftCode: string | null
  shiftName: string | null
  hasApprovedLeave: number
}

export const attendanceService = {
  list(query: AttendanceQuery) {
    return attendanceRepo.findAll(query)
  },

  getById(id: string) {
    return attendanceRepo.findById(id)
  },

  create(data: CreateAttendanceInput) {
    return attendanceRepo.create(data)
  },

  update(id: string, data: UpdateAttendanceInput) {
    return attendanceRepo.update(id, data)
  },

  delete(id: string) {
    return attendanceRepo.delete(id)
  },

  /**
   * 按日期推导每个有排班的员工的出勤状态（默认出勤模型）。
   *
   * 优先级：
   * 1. 已批准 LeaveRequest 覆盖 → leave
   * 2. Schedule.status 显式为 leave/absent/late/early → 原样返回
   * 3. 其它 scheduled/completed → normal（默认出勤）
   *
   * 没有排班的员工不会出现在结果里（业务上视为"休息日"）。
   */
  async deriveDailyAttendance(params: {
    from: string
    to: string
    teamId?: string
    employeeId?: string
  }): Promise<DerivedAttendance[]> {
    const cond: string[] = ["s.`shiftDate` >= ?", "s.`shiftDate` <= ?"]
    const args: unknown[] = [params.from, params.to]
    if (params.teamId) {
      cond.push("s.`teamId` = ?")
      args.push(params.teamId)
    }
    if (params.employeeId) {
      cond.push("s.`employeeId` = ?")
      args.push(params.employeeId)
    }
    const sql = `
      SELECT
        s.\`shiftDate\`      AS date,
        s.\`status\`         AS scheduleStatus,
        s.\`employeeId\`     AS employeeId,
        e.\`name\`           AS employeeName,
        e.\`position\`       AS position,
        s.\`teamId\`         AS teamId,
        t.\`name\`           AS teamName,
        sh.\`code\`          AS shiftCode,
        sh.\`name\`          AS shiftName,
        (
          SELECT COUNT(*) FROM \`LeaveRequest\` lr
          WHERE lr.\`employeeId\` = s.\`employeeId\`
            AND lr.\`status\` = 'approved'
            AND lr.\`startDate\` <= s.\`shiftDate\`
            AND lr.\`endDate\`   >= s.\`shiftDate\`
        ) AS hasApprovedLeave
      FROM \`Schedule\` s
      INNER JOIN \`Employee\` e ON e.\`id\` = s.\`employeeId\`
      INNER JOIN \`Team\`     t ON t.\`id\` = s.\`teamId\`
      INNER JOIN \`Shift\`    sh ON sh.\`id\` = s.\`shiftId\`
      WHERE ${cond.join(" AND ")}
      ORDER BY s.\`shiftDate\` ASC, t.\`name\` ASC, e.\`name\` ASC
    `
    const rows = await queryRows<DerivedRow>(sql, args)

    return rows.map((r) => {
      let status: DerivedAttendance["status"] = "normal"
      if (r.hasApprovedLeave > 0) {
        status = "leave"
      } else if (
        r.scheduleStatus === "leave" ||
        r.scheduleStatus === "absent" ||
        r.scheduleStatus === "late" ||
        r.scheduleStatus === "early"
      ) {
        status = r.scheduleStatus as DerivedAttendance["status"]
      }
      return {
        date: r.date,
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        position: r.position,
        teamId: r.teamId,
        teamName: r.teamName,
        status,
        shiftCode: r.shiftCode,
        shiftName: r.shiftName,
      }
    })
  },

  /**
   * 月度出勤统计聚合
   *
   * 实现策略：
   * - 若 AttendanceRecord 当月有真实打卡数据 → 用真实数据聚合
   * - 否则回退到 deriveDailyAttendance（默认出勤模型）
   *
   * 这样在未接入打卡系统时仍能给总经理返回可用的月度数据。
   */
  async monthlyStats(month: string, teamId?: string): Promise<EmployeeMonthlyStats[]> {
    const records = await attendanceRepo.findByMonth(month, teamId)

    if (records.length > 0) {
      const map = new Map<string, EmployeeMonthlyStats>()
      for (const r of records) {
        if (!("employee" in r) || !r.employee) continue
        const emp = r.employee
        let stats = map.get(emp.id)
        if (!stats) {
          stats = {
            employeeId: emp.id,
            employeeName: emp.name,
            position: emp.position,
            teamId: emp.teamId,
            totalDays: 0,
            normalDays: 0,
            lateDays: 0,
            earlyDays: 0,
            absentDays: 0,
          }
          map.set(emp.id, stats)
        }
        stats.totalDays++
        const status = r.status as "normal" | "late" | "early" | "absent"
        if (status === "normal") stats.normalDays++
        else if (status === "late") stats.lateDays++
        else if (status === "early") stats.earlyDays++
        else if (status === "absent") stats.absentDays++
      }
      return sortStats(Array.from(map.values()))
    }

    const from = `${month}-01`
    const lastDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()
    const to = `${month}-${String(lastDay).padStart(2, "0")}`
    const derived = await this.deriveDailyAttendance({ from, to, teamId })

    const map = new Map<string, EmployeeMonthlyStats>()
    for (const d of derived) {
      let stats = map.get(d.employeeId)
      if (!stats) {
        stats = {
          employeeId: d.employeeId,
          employeeName: d.employeeName,
          position: d.position,
          teamId: d.teamId,
          totalDays: 0,
          normalDays: 0,
          lateDays: 0,
          earlyDays: 0,
          absentDays: 0,
        }
        map.set(d.employeeId, stats)
      }
      stats.totalDays++
      if (d.status === "normal") stats.normalDays++
      else if (d.status === "late") stats.lateDays++
      else if (d.status === "early") stats.earlyDays++
      else if (d.status === "absent" || d.status === "leave") stats.absentDays++
    }
    return sortStats(Array.from(map.values()))
  },

  /** 根据预警阈值检测异常 */
  async detectAlerts(month: string, config: AlertConfig, teamId?: string): Promise<AlertItem[]> {
    const stats = await this.monthlyStats(month, teamId)
    const alerts: AlertItem[] = []

    for (const s of stats) {
      if (s.lateDays >= config.lateThreshold) {
        alerts.push({
          employeeId: s.employeeId,
          employeeName: s.employeeName,
          type: "late",
          label: "迟到次数过多",
          count: s.lateDays,
          threshold: config.lateThreshold,
        })
      }
      if (s.absentDays >= config.absentThreshold) {
        alerts.push({
          employeeId: s.employeeId,
          employeeName: s.employeeName,
          type: "absent",
          label: "缺勤次数过多",
          count: s.absentDays,
          threshold: config.absentThreshold,
        })
      }
      if (s.earlyDays >= config.earlyThreshold) {
        alerts.push({
          employeeId: s.employeeId,
          employeeName: s.employeeName,
          type: "early",
          label: "早退次数过多",
          count: s.earlyDays,
          threshold: config.earlyThreshold,
        })
      }
    }

    return alerts.sort((a, b) => b.count - a.count)
  },
}

function sortStats(list: EmployeeMonthlyStats[]): EmployeeMonthlyStats[] {
  return list.sort((a, b) => {
    const aIssues = a.lateDays + a.earlyDays + a.absentDays
    const bIssues = b.lateDays + b.earlyDays + b.absentDays
    return bIssues - aIssues
  })
}
