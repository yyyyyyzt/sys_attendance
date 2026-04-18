/**
 * 临时脚本：从 example1 / example2 各取少量行，用 mysql2 直连写入 DATABASE_URL 指向的 MySQL（不经过 Prisma）。
 *
 * 用法：
 *   npx tsx --require dotenv/config scripts/sample-import-mysql.ts
 *   npx tsx --require dotenv/config scripts/sample-import-mysql.ts -- --fresh-sample
 *
 * --fresh-sample：删除本脚本固定部门 ID 下的班组/员工/排班后再写入（不删全库；Shift 按 code upsert，不删其他库里的班次）。
 */
import "dotenv/config"
import fs from "fs"
import path from "path"
import { createHash, randomUUID } from "crypto"
import mysql from "mysql2/promise"
import {
  firstSegmentTimes,
  parseScheduleMatrixCsv,
  parseShiftDefinitionsCsv,
  segmentsFromTimeSchedule,
} from "../src/lib/scheduling/matrix-csv"

const SAMPLE_DEPARTMENT_ID = "a0000000-0000-4000-8000-000000000001"
const SAMPLE_DEPARTMENT_NAME = "【样本导入】客服中心"

/** 同一 seed 得到稳定 UUID，便于重复执行 */
function deterministicUuid(seed: string): string {
  const h = createHash("sha256").update(`kaoqin-sample:${seed}`).digest("hex")
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`
}

function teamIdForName(teamName: string): string {
  return deterministicUuid(`team:${teamName}`)
}

const MAX_SHIFT_ROWS = 5
const MAX_MATRIX_EMPLOYEE_ROWS = 4
const MAX_DATE_COLUMNS = 8

function stripMysqlQueryString(url: string): string {
  const q = url.indexOf("?")
  return q === -1 ? url : url.slice(0, q)
}

async function main() {
  const rawUrl = process.env.DATABASE_URL
  if (!rawUrl || !rawUrl.startsWith("mysql://")) {
    console.error("请在 .env 中配置 DATABASE_URL=mysql://...")
    process.exit(1)
  }
  const url = stripMysqlQueryString(rawUrl)
  const fresh = process.argv.includes("--fresh-sample")

  const root = process.cwd()
  const shiftsPath = path.join(root, "example2.csv")
  const matrixPath = path.join(root, "example1.csv")
  if (!fs.existsSync(shiftsPath) || !fs.existsSync(matrixPath)) {
    console.error("缺少 example1.csv 或 example2.csv（应在项目根目录）")
    process.exit(1)
  }

  const shiftsContent = fs.readFileSync(shiftsPath, "utf-8")
  const matrixContent = fs.readFileSync(matrixPath, "utf-8")
  const { shifts: allShifts, errors: e1 } = parseShiftDefinitionsCsv(shiftsContent)
  const { rows: allMatrix, errors: e2 } = parseScheduleMatrixCsv(matrixContent)
  const parseErrors = [...e1, ...e2]
  if (parseErrors.length) console.warn("解析告警：", parseErrors.slice(0, 10))

  const parsedShifts = allShifts.slice(0, MAX_SHIFT_ROWS)
  const matrixRows = allMatrix.slice(0, MAX_MATRIX_EMPLOYEE_ROWS)
  const allDates = [
    ...new Set(matrixRows.flatMap((r) => r.assignments.map((a) => a.shiftDate))),
  ].sort()
  const keepDates = new Set(allDates.slice(0, MAX_DATE_COLUMNS))

  const matrixRowsSliced = matrixRows.map((r) => ({
    ...r,
    assignments: r.assignments.filter((a) => keepDates.has(a.shiftDate)),
  }))

  const pool = mysql.createPool({ uri: url, waitForConnections: true, connectionLimit: 2 })
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    if (fresh) {
      const [teams] = await conn.query<mysql.RowDataPacket[]>(
        "SELECT `id` FROM `Team` WHERE `departmentId` = ?",
        [SAMPLE_DEPARTMENT_ID],
      )
      const teamIds = teams.map((t) => t.id as string)
      if (teamIds.length > 0) {
        const ph = teamIds.map(() => "?").join(",")
        await conn.query(`DELETE FROM \`Schedule\` WHERE \`teamId\` IN (${ph})`, teamIds)
        await conn.query(`DELETE FROM \`Employee\` WHERE \`teamId\` IN (${ph})`, teamIds)
        await conn.query(`DELETE FROM \`Team\` WHERE \`id\` IN (${ph})`, teamIds)
      }
      await conn.query("DELETE FROM `Department` WHERE `id` = ?", [SAMPLE_DEPARTMENT_ID])
    }

    await conn.query(
      "INSERT INTO `Department` (`id`, `name`, `createdAt`) VALUES (?, ?, NOW(3)) ON DUPLICATE KEY UPDATE `name` = VALUES(`name`)",
      [SAMPLE_DEPARTMENT_ID, SAMPLE_DEPARTMENT_NAME],
    )

    const teamNameSet = new Set(matrixRowsSliced.map((r) => r.teamName))
    for (const teamName of teamNameSet) {
      const tid = teamIdForName(teamName)
      await conn.query(
        `INSERT INTO \`Team\` (\`id\`, \`name\`, \`description\`, \`departmentId\`, \`leaveThreshold\`, \`createdAt\`)
         VALUES (?, ?, NULL, ?, 3, NOW(3))
         ON DUPLICATE KEY UPDATE \`name\` = VALUES(\`name\`), \`departmentId\` = VALUES(\`departmentId\`)`,
        [tid, teamName, SAMPLE_DEPARTMENT_ID],
      )
    }

    const codeToShiftId = new Map<string, string>()

    for (const s of parsedShifts) {
      const { startTime, endTime } = firstSegmentTimes(s.timeScheduleRaw)
      const isCrossNight = s.remark.includes("跨夜") || s.code.startsWith("夜")
      const segments = segmentsFromTimeSchedule(s.timeScheduleRaw)
      const workMinutes = Math.round(s.workHours * 60)
      const segmentsJson = JSON.stringify(segments)
      const shiftId = deterministicUuid(`shift:${s.code}`)

      const [existing] = await conn.query<mysql.RowDataPacket[]>(
        "SELECT `id` FROM `Shift` WHERE `code` = ? LIMIT 1",
        [s.code],
      )
      if (existing.length > 0) {
        const id = existing[0].id as string
        await conn.query(
          `UPDATE \`Shift\` SET \`name\`=?, \`startTime\`=?, \`endTime\`=?, \`isCrossNight\`=?, \`requiredCount\`=1, \`workMinutes\`=?, \`segmentsJson\`=CAST(? AS JSON), \`remark\`=? WHERE \`id\`=?`,
          [s.name, startTime, endTime, isCrossNight, workMinutes, segmentsJson, s.remark || null, id],
        )
        codeToShiftId.set(s.code, id)
      } else {
        await conn.query(
          `INSERT INTO \`Shift\` (\`id\`, \`code\`, \`name\`, \`startTime\`, \`endTime\`, \`isCrossNight\`, \`requiredCount\`, \`workMinutes\`, \`segmentsJson\`, \`remark\`, \`createdAt\`)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, CAST(? AS JSON), ?, NOW(3))`,
          [shiftId, s.code, s.name, startTime, endTime, isCrossNight, workMinutes, segmentsJson, s.remark || null],
        )
        codeToShiftId.set(s.code, shiftId)
      }
    }

    for (const r of matrixRowsSliced) {
      const teamId = teamIdForName(r.teamName)
      const skillsJson = "[]"
      const pos = r.position || "组员"

      const [empRows] = await conn.query<mysql.RowDataPacket[]>(
        "SELECT `id` FROM `Employee` WHERE `teamId` = ? AND `name` = ? LIMIT 1",
        [teamId, r.employeeName],
      )
      let empId: string
      if (empRows.length > 0) {
        empId = empRows[0].id as string
        await conn.query(
          "UPDATE `Employee` SET `position` = ?, `skills` = CAST(? AS JSON), `status` = 'active', `updatedAt` = NOW(3) WHERE `id` = ?",
          [pos, skillsJson, empId],
        )
      } else {
        empId = randomUUID()
        await conn.query(
          `INSERT INTO \`Employee\` (\`id\`, \`name\`, \`teamId\`, \`position\`, \`skills\`, \`status\`, \`createdAt\`, \`updatedAt\`)
           VALUES (?, ?, ?, ?, CAST(? AS JSON), 'active', NOW(3), NOW(3))`,
          [empId, r.employeeName, teamId, pos, skillsJson],
        )
      }

      await conn.query("DELETE FROM `Schedule` WHERE `employeeId` = ?", [empId])

      for (const a of r.assignments) {
        const shiftId = codeToShiftId.get(a.shiftCode)
        if (!shiftId) {
          console.warn(`跳过未知班次「${a.shiftCode}」(${r.employeeName} ${a.shiftDate})`)
          continue
        }
        const sid = randomUUID()
        await conn.query(
          `INSERT INTO \`Schedule\` (\`id\`, \`employeeId\`, \`teamId\`, \`shiftId\`, \`shiftDate\`, \`status\`, \`note\`, \`createdAt\`, \`updatedAt\`)
           VALUES (?, ?, ?, ?, ?, 'scheduled', NULL, NOW(3), NOW(3))`,
          [sid, empId, teamId, shiftId, a.shiftDate],
        )
      }
    }

    await conn.commit()
    console.log("样本导入完成（mysql2，无 Prisma）")
    console.log({
      departmentId: SAMPLE_DEPARTMENT_ID,
      shifts: parsedShifts.length,
      employees: matrixRowsSliced.length,
      dateSpan: [...keepDates].join(" ~ "),
      shiftCodes: parsedShifts.map((s) => s.code),
      fresh,
    })
  } catch (e) {
    await conn.rollback()
    const err = e as { code?: string; sqlMessage?: string }
    if (err.code === "ER_NO_SUCH_TABLE") {
      console.error(
        "数据库中还没有表结构。请先执行：npm run db:sql -- schema（或 mysql < db/schema.sql）",
      )
    }
    console.error(e)
    process.exit(1)
  } finally {
    conn.release()
    await pool.end()
  }
}

main()
