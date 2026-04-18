"use client"

import { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Download, Upload, FileSpreadsheet, Table as TableIcon } from "lucide-react"
import { toast } from "sonner"

interface Team { id: string; name: string }

export default function ImportExportPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [exportTeam, setExportTeam] = useState("all")
  const [exportFrom, setExportFrom] = useState("")
  const [exportTo, setExportTo] = useState("")

  const [detailFile, setDetailFile] = useState<File | null>(null)
  const [detailErrors, setDetailErrors] = useState<string[]>([])
  const [detailImporting, setDetailImporting] = useState(false)

  const [matrixFile, setMatrixFile] = useState<File | null>(null)
  const [matrixShiftsFile, setMatrixShiftsFile] = useState<File | null>(null)
  const [matrixClearFirst, setMatrixClearFirst] = useState(true)
  const [matrixErrors, setMatrixErrors] = useState<string[]>([])
  const [matrixImporting, setMatrixImporting] = useState(false)
  const [matrixResult, setMatrixResult] = useState<{
    departments: number
    teams: number
    employees: number
    shifts: number
    schedules: number
  } | null>(null)

  const fetchTeams = useCallback(async () => {
    const res = await fetch("/api/teams")
    setTeams(await res.json())
  }, [])

  useEffect(() => { fetchTeams() }, [fetchTeams])

  async function handleExport(format: "detail" | "matrix") {
    if (!exportFrom || !exportTo) {
      toast.error("请选择导出的日期范围")
      return
    }
    const params = new URLSearchParams({ from: exportFrom, to: exportTo })
    if (exportTeam && exportTeam !== "all") params.set("teamId", exportTeam)
    const url = format === "matrix"
      ? `/api/export/schedules-matrix?${params}`
      : `/api/export/schedules?${params}`
    try {
      const res = await fetch(url)
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "导出失败")
        return
      }
      const blob = await res.blob()
      const dlUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = dlUrl
      a.download = format === "matrix"
        ? `排班矩阵_${exportFrom}_${exportTo}.xlsx`
        : `排班表_${exportFrom}_${exportTo}.xlsx`
      a.click()
      URL.revokeObjectURL(dlUrl)
      toast.success("导出成功")
    } catch {
      toast.error("导出失败")
    }
  }

  async function handleDetailImport() {
    if (!detailFile) {
      toast.error("请选择要导入的文件")
      return
    }
    setDetailImporting(true)
    setDetailErrors([])
    try {
      const formData = new FormData()
      formData.append("file", detailFile)
      const res = await fetch("/api/import/schedules", { method: "POST", body: formData })
      const data = await res.json()
      if (!res.ok) {
        if (data.errors && Array.isArray(data.errors)) setDetailErrors(data.errors)
        toast.error(data.error ?? "导入失败")
        return
      }
      toast.success(`导入成功，共导入 ${data.count ?? 0} 条排班记录`)
      setDetailFile(null)
    } catch {
      toast.error("导入失败")
    } finally {
      setDetailImporting(false)
    }
  }

  async function handleMatrixImport() {
    if (!matrixFile) {
      toast.error("请选择矩阵排班文件（.csv 或 .xlsx）")
      return
    }
    setMatrixImporting(true)
    setMatrixErrors([])
    setMatrixResult(null)
    try {
      const fd = new FormData()
      fd.append("matrix", matrixFile)
      if (matrixShiftsFile) fd.append("shifts", matrixShiftsFile)
      fd.append("clearFirst", matrixClearFirst ? "true" : "false")
      const res = await fetch("/api/import/schedules-matrix", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "矩阵导入失败")
        return
      }
      setMatrixResult({
        departments: data.departments ?? 0,
        teams: data.teams ?? 0,
        employees: data.employees ?? 0,
        shifts: data.shifts ?? 0,
        schedules: data.schedules ?? 0,
      })
      if (Array.isArray(data.errors) && data.errors.length > 0) setMatrixErrors(data.errors)
      toast.success(`矩阵导入成功：员工 ${data.employees ?? 0} 人，排班 ${data.schedules ?? 0} 条`)
    } catch {
      toast.error("矩阵导入失败")
    } finally {
      setMatrixImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">导入导出</h2>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="h-4 w-4" />
            导出排班表
          </CardTitle>
          <CardDescription>
            两种格式：明细格式（每行一条排班）与矩阵格式（每行一个员工，列为日期，与 example1.csv 一致）
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>班组</Label>
              <Select value={exportTeam} onValueChange={(v) => setExportTeam(v ?? "all")}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="全部班组">
                    {exportTeam !== "all" ? teams.find((t) => t.id === exportTeam)?.name : "全部班组"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部班组</SelectItem>
                  {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>开始日期</Label>
              <Input type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>结束日期</Label>
              <Input type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)} />
            </div>
            <Button variant="outline" onClick={() => handleExport("detail")}>
              <TableIcon className="mr-1 h-4 w-4" />
              明细导出
            </Button>
            <Button onClick={() => handleExport("matrix")}>
              <FileSpreadsheet className="mr-1 h-4 w-4" />
              矩阵导出
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="h-4 w-4" />
            导入排班表
          </CardTitle>
          <CardDescription>按格式选择对应的 Tab</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="matrix">
            <TabsList>
              <TabsTrigger value="matrix">矩阵格式（推荐）</TabsTrigger>
              <TabsTrigger value="detail">明细格式</TabsTrigger>
            </TabsList>

            <TabsContent value="matrix" className="space-y-4">
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm leading-relaxed text-blue-800">
                <p className="font-medium">矩阵格式说明</p>
                <p className="mt-1">
                  每行一个员工一个月的排班，表头必须为：
                  <code className="mx-1 rounded bg-white px-1 text-xs">班组,姓名,岗位,YYYY/M/D,YYYY/M/D,…</code>
                  单元格填班次代码（如
                  <code className="mx-1 rounded bg-white px-1 text-xs">班1A</code>
                  ），没有排班的写
                  <code className="mx-1 rounded bg-white px-1 text-xs">休息</code>
                  。可同时上传 .csv 或 .xlsx。
                </p>
                <p className="mt-1 text-xs text-blue-600">
                  默认会先清空现有业务数据再重新导入，与 example1.csv + example2.csv 的种子导入逻辑一致。
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>排班矩阵文件（必填 .csv / .xlsx）</Label>
                  <Input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => setMatrixFile(e.target.files?.[0] ?? null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>班次定义文件（可选 .csv / .xlsx，默认用根目录 example2.csv）</Label>
                  <Input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => setMatrixShiftsFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={matrixClearFirst}
                  onChange={(e) => setMatrixClearFirst(e.target.checked)}
                  className="h-4 w-4"
                />
                导入前清空现有业务数据（Schedule/LeaveRequest/Attendance/Employee/Team/Shift）
              </label>
              <Button onClick={handleMatrixImport} disabled={!matrixFile || matrixImporting}>
                <Upload className="mr-1 h-4 w-4" />
                {matrixImporting ? "导入中…" : "开始矩阵导入"}
              </Button>

              {matrixResult && (
                <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                  <p className="font-medium">导入成功</p>
                  <p className="mt-1 grid grid-cols-2 gap-2 md:grid-cols-5">
                    <span>部门 {matrixResult.departments}</span>
                    <span>班组 {matrixResult.teams}</span>
                    <span>员工 {matrixResult.employees}</span>
                    <span>班次 {matrixResult.shifts}</span>
                    <span>排班 {matrixResult.schedules}</span>
                  </p>
                </div>
              )}
              {matrixErrors.length > 0 && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3">
                  <p className="mb-2 text-sm font-medium text-red-700">有 {matrixErrors.length} 条警告：</p>
                  <ul className="list-inside list-disc space-y-1 text-sm text-red-600">
                    {matrixErrors.slice(0, 30).map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              )}
            </TabsContent>

            <TabsContent value="detail" className="space-y-4">
              <p className="text-sm text-zinc-500">
                上传 .xlsx 文件，表头须包含：日期、班组、员工、班次、状态（可选）、备注（可选）
              </p>
              <div className="flex items-end gap-4">
                <div className="space-y-2">
                  <Label>选择文件</Label>
                  <Input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => setDetailFile(e.target.files?.[0] ?? null)}
                  />
                </div>
                <Button onClick={handleDetailImport} disabled={!detailFile || detailImporting}>
                  <Upload className="mr-1 h-4 w-4" />
                  {detailImporting ? "导入中…" : "开始导入"}
                </Button>
              </div>
              {detailErrors.length > 0 && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3">
                  <p className="mb-2 text-sm font-medium text-red-700">以下行导入失败：</p>
                  <ul className="list-inside list-disc space-y-1 text-sm text-red-600">
                    {detailErrors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
