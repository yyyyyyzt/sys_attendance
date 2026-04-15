"use client"

import { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Download, Upload } from "lucide-react"
import { toast } from "sonner"

interface Team { id: string; name: string }

export default function ImportExportPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [exportTeam, setExportTeam] = useState("all")
  const [exportFrom, setExportFrom] = useState("")
  const [exportTo, setExportTo] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [importing, setImporting] = useState(false)

  const fetchTeams = useCallback(async () => {
    const res = await fetch("/api/teams")
    setTeams(await res.json())
  }, [])

  useEffect(() => { fetchTeams() }, [fetchTeams])

  async function handleExport() {
    if (!exportFrom || !exportTo) {
      toast.error("请选择导出的日期范围")
      return
    }
    const params = new URLSearchParams({ from: exportFrom, to: exportTo })
    if (exportTeam && exportTeam !== "all") params.set("teamId", exportTeam)
    try {
      const res = await fetch(`/api/export/schedules?${params}`)
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "导出失败")
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `排班表_${exportFrom}_${exportTo}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("导出成功")
    } catch {
      toast.error("导出失败")
    }
  }

  async function handleImport() {
    if (!file) {
      toast.error("请选择要导入的文件")
      return
    }
    setImporting(true)
    setImportErrors([])
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/import/schedules", { method: "POST", body: formData })
      const data = await res.json()
      if (!res.ok) {
        if (data.errors && Array.isArray(data.errors)) {
          setImportErrors(data.errors)
        }
        toast.error(data.error ?? "导入失败")
        return
      }
      toast.success(`导入成功，共导入 ${data.count ?? 0} 条排班记录`)
      setFile(null)
    } catch {
      toast.error("导入失败")
    } finally {
      setImporting(false)
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
            <Button onClick={handleExport}>
              <Download className="mr-1 h-4 w-4" />
              导出 Excel
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
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-zinc-500">
            请上传 .xlsx 文件，表头须包含：日期、班组、员工、班次、状态（可选）、备注（可选）
          </p>
          <div className="flex items-end gap-4">
            <div className="space-y-2">
              <Label>选择文件</Label>
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <Button onClick={handleImport} disabled={!file || importing}>
              <Upload className="mr-1 h-4 w-4" />
              {importing ? "导入中…" : "开始导入"}
            </Button>
          </div>
          {importErrors.length > 0 && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3">
              <p className="mb-2 text-sm font-medium text-red-700">以下行导入失败：</p>
              <ul className="list-inside list-disc space-y-1 text-sm text-red-600">
                {importErrors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
