import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { apiRouteError } from "@/lib/api-route-error"
import { importRealSchedulesFromCsv } from "@/lib/scheduling/import-real-data"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import os from "os"

/**
 * POST /api/import/schedules-matrix
 * formData:
 *   - matrix: .csv 或 .xlsx（矩阵排班，格式见 example1.csv）
 *   - shifts: .csv（班次定义，可选，默认读根目录 example2.csv）
 *   - clearFirst: 'true' | 'false'，默认 true（清空业务表后导入）
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const matrix = formData.get("matrix")
    const shifts = formData.get("shifts")
    const clearFirst = (formData.get("clearFirst") as string | null) !== "false"

    if (!matrix || !(matrix instanceof Blob)) {
      return NextResponse.json(
        { error: "请上传 matrix 文件（.csv 或 .xlsx 格式的横向排班表）" },
        { status: 400 },
      )
    }

    const tmp = await mkdir(path.join(os.tmpdir(), "kaoqin-import"), { recursive: true }).then(() =>
      path.join(os.tmpdir(), "kaoqin-import"),
    )

    const matrixArrayBuffer = await matrix.arrayBuffer()
    const matrixBuf = Buffer.from(matrixArrayBuffer)
    const matrixFilename = (matrix as File).name ?? ""
    const isXlsx = /\.xlsx?$/i.test(matrixFilename) || looksLikeXlsx(matrixBuf)

    const matrixPath = path.join(tmp, `matrix-${Date.now()}.csv`)
    const csvContent = isXlsx ? xlsxToCsv(matrixArrayBuffer) : matrixBuf.toString("utf-8")
    await writeFile(matrixPath, csvContent, "utf-8")

    let shiftsPath = path.join(process.cwd(), "example2.csv")
    if (shifts && shifts instanceof Blob) {
      shiftsPath = path.join(tmp, `shifts-${Date.now()}.csv`)
      const shiftsArrayBuffer = await shifts.arrayBuffer()
      const shiftsBuf = Buffer.from(shiftsArrayBuffer)
      const shiftsFilename = (shifts as File).name ?? ""
      const shiftsIsXlsx = /\.xlsx?$/i.test(shiftsFilename) || looksLikeXlsx(shiftsBuf)
      const shiftsCsv = shiftsIsXlsx ? xlsxToCsv(shiftsArrayBuffer) : shiftsBuf.toString("utf-8")
      await writeFile(shiftsPath, shiftsCsv, "utf-8")
    }

    const result = await importRealSchedulesFromCsv({
      matrixCsvPath: matrixPath,
      shiftsCsvPath: shiftsPath,
      clearFirst,
    })

    return NextResponse.json(result)
  } catch (err) {
    return apiRouteError("POST /api/import/schedules-matrix", err, "矩阵导入失败", 500)
  }
}

/** 判断 Buffer 是不是 xlsx（ZIP 头 PK\x03\x04） */
function looksLikeXlsx(buf: Buffer): boolean {
  return buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04
}

/** 把上传的 xlsx 转成与 example1.csv 等价的 CSV 字符串 */
function xlsxToCsv(ab: ArrayBuffer): string {
  const wb = XLSX.read(ab, { type: "array", cellDates: false })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) throw new Error("xlsx 文件中没有工作表")
  const ws = wb.Sheets[sheetName]
  return XLSX.utils.sheet_to_csv(ws)
}
