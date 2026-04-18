/**
 * 解析 example2（班次主数据）与 example1（横向排班矩阵）CSV
 */

export interface ParsedShiftDefinition {
  code: string
  name: string
  timeScheduleRaw: string
  remark: string
  workHours: number
}

export interface MatrixAssignment {
  shiftDate: string // YYYY-MM-DD
  shiftCode: string
}

export interface ParsedMatrixEmployeeRow {
  rowIndex: number
  teamName: string
  employeeName: string
  position: string
  assignments: MatrixAssignment[]
}

export interface MatrixParseResult {
  rows: ParsedMatrixEmployeeRow[]
  errors: string[]
}

/** 将表头「2026/4/1」转为 YYYY-MM-DD */
export function parseMatrixDateHeader(raw: string): string | null {
  const s = String(raw).trim()
  const m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/)
  if (!m) return null
  const y = m[1]
  const mo = m[2].padStart(2, "0")
  const d = m[3].padStart(2, "0")
  return `${y}-${mo}-${d}`
}

/**
 * 解析 example2 行：班次代码,班次名称,时间安排(可能含逗号),备注,工时
 * 例：班1A,班1A,8:30-12:00,14:00-18:30,白班,8
 */
export function parseShiftDefinitionLine(line: string, rowNum: number): ParsedShiftDefinition | string {
  const parts = line.split(",")
  if (parts.length < 5) return `第 ${rowNum} 行列数不足`
  const code = parts[0].trim()
  const name = parts[1].trim()
  const hoursRaw = parts[parts.length - 1].trim()
  const remark = parts[parts.length - 2].trim()
  const timeParts = parts.slice(2, parts.length - 2)
  const timeScheduleRaw = timeParts.join(",").trim()
  const workHours = Number(hoursRaw)
  if (!code) return `第 ${rowNum} 行班次代码为空`
  if (!Number.isFinite(workHours) || workHours <= 0) return `第 ${rowNum} 行工时无效`
  return { code, name, timeScheduleRaw, remark, workHours }
}

export function parseShiftDefinitionsCsv(content: string): { shifts: ParsedShiftDefinition[]; errors: string[] } {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0)
  const errors: string[] = []
  if (lines.length < 2) return { shifts: [], errors: ["CSV 无数据行"] }
  const shifts: ParsedShiftDefinition[] = []
  for (let i = 1; i < lines.length; i++) {
    const rowNum = i + 1
    const r = parseShiftDefinitionLine(lines[i], rowNum)
    if (typeof r === "string") errors.push(r)
    else shifts.push(r)
  }
  return { shifts, errors }
}

/** 从「8:30-12:00,14:00-18:30」取首段作为展示起止 */
export function firstSegmentTimes(timeScheduleRaw: string): { startTime: string; endTime: string } {
  const first = timeScheduleRaw.split(",")[0]?.trim() ?? ""
  const m = first.match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/)
  if (m) {
    return { startTime: normalizeHm(m[1]), endTime: normalizeHm(m[2]) }
  }
  return { startTime: "00:00", endTime: "00:00" }
}

function normalizeHm(t: string): string {
  const [h, m] = t.split(":")
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`
}

/** 将时间安排拆成 JSON 数组字符串（存库） */
export function segmentsFromTimeSchedule(raw: string): unknown[] {
  const segs = raw.split(",").map((s) => s.trim()).filter(Boolean)
  return segs.map((s) => {
    const m = s.match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/)
    if (m) return { start: normalizeHm(m[1]), end: normalizeHm(m[2]), raw: s }
    return { raw: s }
  })
}

export function parseScheduleMatrixCsv(content: string): MatrixParseResult {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0)
  const errors: string[] = []
  if (lines.length < 2) return { rows: [], errors: ["矩阵 CSV 无数据"] }

  const headerCells = lines[0].split(",")
  const dateColumns: { index: number; shiftDate: string }[] = []
  for (let c = 3; c < headerCells.length; c++) {
    const d = parseMatrixDateHeader(headerCells[c])
    if (!d) {
      errors.push(`表头第 ${c + 1} 列日期无法解析：${headerCells[c]}`)
      continue
    }
    dateColumns.push({ index: c, shiftDate: d })
  }
  if (dateColumns.length === 0) return { rows: [], errors: errors.length ? errors : ["未找到有效日期列"] }

  const rows: ParsedMatrixEmployeeRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const rowNum = i + 1
    const cells = lines[i].split(",")
    if (cells.length < 3) {
      errors.push(`第 ${rowNum} 行列数不足`)
      continue
    }
    const teamName = cells[0].trim()
    const employeeName = cells[1].trim()
    const position = cells[2].trim()
    if (!teamName || !employeeName) {
      errors.push(`第 ${rowNum} 行班组或姓名为空`)
      continue
    }
    const assignments: MatrixAssignment[] = []
    for (const { index, shiftDate } of dateColumns) {
      const cell = (cells[index] ?? "").trim()
      if (!cell || cell === "休息") continue
      assignments.push({ shiftDate, shiftCode: cell })
    }
    rows.push({ rowIndex: rowNum, teamName, employeeName, position, assignments })
  }

  return { rows, errors }
}
