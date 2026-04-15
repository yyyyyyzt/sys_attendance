import { attendanceRepo } from "@/lib/repos/attendance"
import type {
  CreateAttendanceInput,
  UpdateAttendanceInput,
  AttendanceQuery,
  AlertConfig,
} from "@/lib/validation/attendance"

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

  /** 月度出勤统计聚合 */
  async monthlyStats(month: string, teamId?: string): Promise<EmployeeMonthlyStats[]> {
    const records = await attendanceRepo.findByMonth(month, teamId)

    const map = new Map<string, EmployeeMonthlyStats>()
    for (const r of records) {
      const emp = r.employee as { id: string; name: string; position: string; teamId: string }
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

    return Array.from(map.values()).sort((a, b) => {
      const aIssues = a.lateDays + a.earlyDays + a.absentDays
      const bIssues = b.lateDays + b.earlyDays + b.absentDays
      return bIssues - aIssues
    })
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
