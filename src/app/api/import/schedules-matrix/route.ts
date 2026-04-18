import { NextResponse } from "next/server"
import { apiRouteError } from "@/lib/api-route-error"
import { importRealSchedulesFromCsv } from "@/lib/scheduling/import-real-data"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import os from "os"

/** 上传矩阵 CSV + 班次 CSV，清空并导入（与 seed 同源逻辑） */
export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const matrix = formData.get("matrix")
    const shifts = formData.get("shifts")
    const clearFirst = (formData.get("clearFirst") as string | null) !== "false"

    if (!matrix || !(matrix instanceof Blob)) {
      return NextResponse.json({ error: "请上传 matrix 文件（横向排班 CSV）" }, { status: 400 })
    }

    const tmp = await mkdir(path.join(os.tmpdir(), "kaoqin-import"), { recursive: true }).then(() =>
      path.join(os.tmpdir(), "kaoqin-import"),
    )
    const matrixPath = path.join(tmp, `matrix-${Date.now()}.csv`)
    const buf = Buffer.from(await matrix.arrayBuffer())
    await writeFile(matrixPath, buf)

    let shiftsPath = path.join(process.cwd(), "example2.csv")
    if (shifts && shifts instanceof Blob) {
      shiftsPath = path.join(tmp, `shifts-${Date.now()}.csv`)
      await writeFile(shiftsPath, Buffer.from(await shifts.arrayBuffer()))
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
