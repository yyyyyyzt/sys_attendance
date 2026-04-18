import * as XLSX from "xlsx"

export interface ScheduleExportRow {
  日期: string
  班组: string
  员工: string
  班次: string
  状态: string
  备注: string
}

export interface ScheduleImportRow {
  日期?: string
  班组?: string
  员工?: string
  班次?: string
  状态?: string
  备注?: string
}

/** 将排班数据导出为 xlsx Buffer（明细格式） */
export function exportSchedulesToXlsx(rows: ScheduleExportRow[]): Buffer {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, "排班明细")

  const colWidths = [
    { wch: 12 }, // 日期
    { wch: 12 }, // 班组
    { wch: 10 }, // 员工
    { wch: 16 }, // 班次
    { wch: 8 },  // 状态
    { wch: 20 }, // 备注
  ]
  ws["!cols"] = colWidths

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer
}

export interface MatrixScheduleEntry {
  teamName: string
  employeeName: string
  position: string
  /** dateStr (YYYY-MM-DD) → 班次代码或空串；"休息" 用于没有排班的日期 */
  byDate: Record<string, string>
}

/**
 * 将排班数据导出为矩阵格式 xlsx（第 1 列班组、2 列姓名、3 列岗位，其后每列一天）。
 * 与 example1.csv 表头格式一致：`YYYY/M/D`。
 */
export function exportSchedulesAsMatrix(entries: MatrixScheduleEntry[], dates: string[]): Buffer {
  const header = ["班组", "姓名", "岗位", ...dates.map((d) => formatMatrixDate(d))]
  const matrix: (string | number)[][] = [header]
  for (const e of entries) {
    const row: string[] = [e.teamName, e.employeeName, e.position]
    for (const d of dates) {
      row.push(e.byDate[d] || "休息")
    }
    matrix.push(row)
  }

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(matrix)
  XLSX.utils.book_append_sheet(wb, ws, "排班矩阵")
  ws["!cols"] = [
    { wch: 8 },
    { wch: 10 },
    { wch: 8 },
    ...dates.map(() => ({ wch: 6 })),
  ]
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer
}

/** YYYY-MM-DD → YYYY/M/D（对齐 example1.csv） */
function formatMatrixDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-")
  return `${y}/${Number(m)}/${Number(d)}`
}

export interface ParsedImportRow {
  rowIndex: number
  teamName: string
  employeeName: string
  shiftName: string
  shiftDate: string
  status: string
  note: string
}

export interface ImportParseResult {
  rows: ParsedImportRow[]
  errors: string[]
}

const validStatuses = ["scheduled", "leave", "cancelled", "completed"]

/** 解析上传的 xlsx 文件，返回结构化行与行级错误 */
export function parseScheduleImport(buffer: ArrayBuffer): ImportParseResult {
  const wb = XLSX.read(buffer, { type: "array" })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) return { rows: [], errors: ["文件中没有工作表"] }

  const raw = XLSX.utils.sheet_to_json<ScheduleImportRow>(wb.Sheets[sheetName])
  if (raw.length === 0) return { rows: [], errors: ["工作表中没有数据"] }
  if (raw.length > 500) return { rows: [], errors: ["单次导入不能超过 500 行"] }

  const rows: ParsedImportRow[] = []
  const errors: string[] = []

  raw.forEach((r, i) => {
    const rowNum = i + 2
    const missing: string[] = []
    if (!r.日期) missing.push("日期")
    if (!r.班组) missing.push("班组")
    if (!r.员工) missing.push("员工")
    if (!r.班次) missing.push("班次")
    if (missing.length > 0) {
      errors.push(`第 ${rowNum} 行缺少必填列：${missing.join("、")}`)
      return
    }
    const dateStr = String(r.日期).trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      errors.push(`第 ${rowNum} 行日期格式不正确，需为 YYYY-MM-DD`)
      return
    }
    const status = r.状态 ? String(r.状态).trim() : "scheduled"
    if (!validStatuses.includes(status)) {
      errors.push(`第 ${rowNum} 行状态无效，可选值：${validStatuses.join("/")}`)
      return
    }
    rows.push({
      rowIndex: rowNum,
      shiftDate: dateStr,
      teamName: String(r.班组).trim(),
      employeeName: String(r.员工).trim(),
      shiftName: String(r.班次).trim(),
      status,
      note: r.备注 ? String(r.备注).trim() : "",
    })
  })

  return { rows, errors }
}
