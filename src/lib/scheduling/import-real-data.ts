import fs from "fs"
import path from "path"
import { randomUUID } from "crypto"
import type { PoolConnection } from "mysql2/promise"
import { getPool } from "@/lib/db"
import {
  firstSegmentTimes,
  parseScheduleMatrixCsv,
  parseShiftDefinitionsCsv,
  segmentsFromTimeSchedule,
} from "@/lib/scheduling/matrix-csv"
import { stringArrayToJsonValue } from "@/lib/json-array"
import type { RowDataPacket } from "mysql2"

export interface ImportRealDataOptions {
  matrixCsvPath: string
  shiftsCsvPath: string
  clearFirst: boolean
  departmentName?: string
}

export interface ImportRealDataResult {
  departments: number
  teams: number
  employees: number
  shifts: number
  schedules: number
  errors: string[]
}

async function wipeBusinessData(c: PoolConnection) {
  await c.execute("DELETE FROM `Schedule`")
  await c.execute("DELETE FROM `LeaveRequest`")
  await c.execute("DELETE FROM `AttendanceRecord`")
  await c.execute("DELETE FROM `LeaveBalanceAccount`")
  await c.execute("DELETE FROM `LeavePolicyRule`")
  await c.execute("DELETE FROM `Employee`")
  await c.execute("DELETE FROM `Team`")
  await c.execute("DELETE FROM `Shift`")
  await c.execute("DELETE FROM `Department`")
}

type PolicyRow = {
  leaveType: string
  maxDays: number | null
  isPaid: boolean
  requiresProof: boolean
  note: string
}

const defaultPolicies: PolicyRow[] = [
  { leaveType: "ANNUAL", maxDays: null, isPaid: true, requiresProof: false, note: "年假（余额维护）" },
  { leaveType: "CHILD_CARE", maxDays: null, isPaid: true, requiresProof: false, note: "育儿假（余额维护）" },
  { leaveType: "SICK", maxDays: null, isPaid: false, requiresProof: true, note: "病假" },
  { leaveType: "PERSONAL", maxDays: null, isPaid: false, requiresProof: false, note: "事假" },
  { leaveType: "MARRIAGE", maxDays: 10, isPaid: true, requiresProof: false, note: "婚假" },
  { leaveType: "NURSING", maxDays: null, isPaid: true, requiresProof: false, note: "护理假" },
  { leaveType: "PATERNITY", maxDays: null, isPaid: true, requiresProof: false, note: "陪产假" },
  { leaveType: "BEREAVEMENT", maxDays: null, isPaid: true, requiresProof: false, note: "丧假" },
]

/** 从 CSV 导入班次、班组、员工与排班（mysql2 事务，不依赖 Prisma） */
export async function importRealSchedulesFromCsv(opts: ImportRealDataOptions): Promise<ImportRealDataResult> {
  const errors: string[] = []
  const deptName = opts.departmentName ?? "客服中心"
  const pool = getPool()
  const c = await pool.getConnection()

  try {
    await c.beginTransaction()

    if (opts.clearFirst) {
      await wipeBusinessData(c)
    }

    const shiftsContent = fs.readFileSync(opts.shiftsCsvPath, "utf-8")
    const { shifts: parsedShifts, errors: shiftParseErr } = parseShiftDefinitionsCsv(shiftsContent)
    errors.push(...shiftParseErr)

    const shiftCount = parsedShifts.length
    for (const s of parsedShifts) {
      const { startTime, endTime } = firstSegmentTimes(s.timeScheduleRaw)
      const isCrossNight = s.remark.includes("跨夜") || s.code.startsWith("夜")
      const segments = segmentsFromTimeSchedule(s.timeScheduleRaw)
      const workMinutes = Math.round(s.workHours * 60)
      const segJson = JSON.stringify(segments)

      const [shiftSel] = await c.execute<RowDataPacket[]>(
        "SELECT `id` FROM `Shift` WHERE `code` = ? LIMIT 1",
        [s.code],
      )
      const shiftRows = shiftSel as RowDataPacket[]
      if (shiftRows.length > 0) {
        await c.execute(
          `UPDATE \`Shift\` SET \`name\`=?, \`startTime\`=?, \`endTime\`=?, \`isCrossNight\`=?, \`workMinutes\`=?, \`segmentsJson\`=CAST(? AS JSON), \`remark\`=? WHERE \`id\`=?`,
          [s.name, startTime, endTime, isCrossNight, workMinutes, segJson, s.remark || null, shiftRows[0].id],
        )
      } else {
        const sid = randomUUID()
        await c.execute(
          `INSERT INTO \`Shift\` (\`id\`, \`code\`, \`name\`, \`startTime\`, \`endTime\`, \`isCrossNight\`, \`requiredCount\`, \`workMinutes\`, \`segmentsJson\`, \`remark\`, \`createdAt\`)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, CAST(? AS JSON), ?, NOW(3))`,
          [sid, s.code, s.name, startTime, endTime, isCrossNight, workMinutes, segJson, s.remark || null],
        )
      }
    }

    const [allShiftPacket] = await c.execute<RowDataPacket[]>("SELECT `id`, `code` FROM `Shift`", [])
    const allShiftRows = allShiftPacket as RowDataPacket[]
    const codeToShiftId = new Map(allShiftRows.map((x) => [x.code as string, x.id as string]))

    const matrixContent = fs.readFileSync(opts.matrixCsvPath, "utf-8")
    const { rows: matrixRows, errors: matrixErr } = parseScheduleMatrixCsv(matrixContent)
    errors.push(...matrixErr)

    const deptId = randomUUID()
    await c.execute(
      "INSERT INTO `Department` (`id`, `name`, `createdAt`) VALUES (?, ?, NOW(3))",
      [deptId, deptName],
    )

    const teamNameToId = new Map<string, string>()

    for (const r of matrixRows) {
      let teamId = teamNameToId.get(r.teamName)
      if (!teamId) {
        teamId = randomUUID()
        await c.execute(
          `INSERT INTO \`Team\` (\`id\`, \`name\`, \`description\`, \`departmentId\`, \`leaveThreshold\`, \`createdAt\`)
           VALUES (?, ?, NULL, ?, 3, NOW(3))`,
          [teamId, r.teamName, deptId],
        )
        teamNameToId.set(r.teamName, teamId)
      }

      const [empPacket] = await c.execute<RowDataPacket[]>(
        "SELECT `id` FROM `Employee` WHERE `teamId` = ? AND `name` = ? LIMIT 1",
        [teamId, r.employeeName],
      )
      const er = empPacket as RowDataPacket[]
      let empId: string
      if (er.length > 0) {
        empId = er[0].id as string
        await c.execute(
          "UPDATE `Employee` SET `position` = ?, `status` = 'active', `skills` = CAST(? AS JSON), `updatedAt` = NOW(3) WHERE `id` = ?",
          [r.position || "组员", stringArrayToJsonValue([]), empId],
        )
      } else {
        empId = randomUUID()
        await c.execute(
          `INSERT INTO \`Employee\` (\`id\`, \`name\`, \`teamId\`, \`position\`, \`skills\`, \`status\`, \`createdAt\`, \`updatedAt\`)
           VALUES (?, ?, ?, ?, CAST(? AS JSON), 'active', NOW(3), NOW(3))`,
          [empId, r.employeeName, teamId, r.position || "组员", stringArrayToJsonValue([])],
        )
      }

      for (const a of r.assignments) {
        const shiftId = codeToShiftId.get(a.shiftCode)
        if (!shiftId) {
          errors.push(`第 ${r.rowIndex} 行：未知班次代码「${a.shiftCode}」`)
          continue
        }
        const [schPacket] = await c.execute<RowDataPacket[]>(
          "SELECT `id` FROM `Schedule` WHERE `employeeId` = ? AND `shiftDate` = ? AND `shiftId` = ? LIMIT 1",
          [empId, a.shiftDate, shiftId],
        )
        const sch = schPacket as RowDataPacket[]
        if (sch.length > 0) {
          await c.execute(
            "UPDATE `Schedule` SET `teamId` = ?, `status` = 'scheduled', `updatedAt` = NOW(3) WHERE `id` = ?",
            [teamId, sch[0].id],
          )
        } else {
          const sid = randomUUID()
          await c.execute(
            `INSERT INTO \`Schedule\` (\`id\`, \`employeeId\`, \`teamId\`, \`shiftId\`, \`shiftDate\`, \`status\`, \`note\`, \`createdAt\`, \`updatedAt\`)
             VALUES (?, ?, ?, ?, ?, 'scheduled', NULL, NOW(3), NOW(3))`,
            [sid, empId, teamId, shiftId, a.shiftDate],
          )
        }
      }
    }

    if (opts.clearFirst) {
      for (const p of defaultPolicies) {
        const pid = randomUUID()
        await c.execute(
          `INSERT INTO \`LeavePolicyRule\` (\`id\`, \`leaveType\`, \`maxDays\`, \`isPaid\`, \`requiresProof\`, \`note\`, \`createdAt\`, \`updatedAt\`)
           VALUES (?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
          [pid, p.leaveType, p.maxDays, p.isPaid, p.requiresProof, p.note],
        )
      }
    }

    const [empCntPacket] = await c.execute<RowDataPacket[]>("SELECT COUNT(*) AS c FROM `Employee`", [])
    const [schCntPacket] = await c.execute<RowDataPacket[]>("SELECT COUNT(*) AS c FROM `Schedule`", [])
    const empCntRows = empCntPacket as RowDataPacket[]
    const schCntRows = schCntPacket as RowDataPacket[]
    const employeeTotal = Number(empCntRows[0]?.c ?? 0)
    const scheduleTotal = Number(schCntRows[0]?.c ?? 0)

    await c.commit()

    return {
      departments: 1,
      teams: teamNameToId.size,
      employees: employeeTotal,
      shifts: shiftCount,
      schedules: scheduleTotal,
      errors,
    }
  } catch (e) {
    await c.rollback()
    throw e
  } finally {
    c.release()
  }
}

export function defaultExampleCsvPaths(cwd = process.cwd()) {
  return {
    matrixCsvPath: path.join(cwd, "example1.csv"),
    shiftsCsvPath: path.join(cwd, "example2.csv"),
  }
}
