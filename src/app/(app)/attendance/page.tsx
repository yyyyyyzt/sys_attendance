"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Plus, BarChart3, AlertTriangle, Clock, UserX, ArrowDownLeft,
} from "lucide-react"
import { toast } from "sonner"

interface Team { id: string; name: string }
interface Employee { id: string; name: string }
interface AttendanceRecord {
  id: string
  employeeId: string
  date: string
  checkIn: string | null
  checkOut: string | null
  status: string
  employee: { id: string; name: string; position: string; teamId: string }
}
interface MonthlyStats {
  employeeId: string
  employeeName: string
  position: string
  totalDays: number
  normalDays: number
  lateDays: number
  earlyDays: number
  absentDays: number
}
interface AlertItem {
  employeeId: string
  employeeName: string
  type: string
  label: string
  count: number
  threshold: number
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  normal: { label: "正常", variant: "default" },
  late: { label: "迟到", variant: "secondary" },
  early: { label: "早退", variant: "outline" },
  absent: { label: "缺勤", variant: "destructive" },
}

function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7)
}

export default function AttendancePage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [stats, setStats] = useState<MonthlyStats[]>([])
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedTeam, setSelectedTeam] = useState("all")
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth)

  // 预警阈值
  const [lateThreshold, setLateThreshold] = useState(3)
  const [absentThreshold, setAbsentThreshold] = useState(1)
  const [earlyThreshold, setEarlyThreshold] = useState(3)

  // 新增记录 Dialog
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState({
    employeeId: "", date: "", checkIn: "", checkOut: "", status: "normal",
  })

  const fetchMeta = useCallback(async () => {
    const [tRes, eRes] = await Promise.all([fetch("/api/teams"), fetch("/api/employees")])
    setTeams(await tRes.json())
    setEmployees(await eRes.json())
  }, [])

  const fetchRecords = useCallback(async () => {
    const from = `${selectedMonth}-01`
    const lastDay = new Date(Number(selectedMonth.slice(0, 4)), Number(selectedMonth.slice(5, 7)), 0).getDate()
    const to = `${selectedMonth}-${String(lastDay).padStart(2, "0")}`
    const params = new URLSearchParams({ from, to })
    if (selectedTeam && selectedTeam !== "all") params.set("teamId", selectedTeam)
    const res = await fetch(`/api/attendance?${params}`)
    setRecords(await res.json())
  }, [selectedMonth, selectedTeam])

  const fetchStats = useCallback(async () => {
    const params = new URLSearchParams({ month: selectedMonth })
    if (selectedTeam && selectedTeam !== "all") params.set("teamId", selectedTeam)
    const res = await fetch(`/api/attendance/stats?${params}`)
    setStats(await res.json())
  }, [selectedMonth, selectedTeam])

  const fetchAlerts = useCallback(async () => {
    const params = new URLSearchParams({
      month: selectedMonth,
      lateThreshold: String(lateThreshold),
      absentThreshold: String(absentThreshold),
      earlyThreshold: String(earlyThreshold),
    })
    if (selectedTeam && selectedTeam !== "all") params.set("teamId", selectedTeam)
    const res = await fetch(`/api/attendance/alerts?${params}`)
    setAlerts(await res.json())
  }, [selectedMonth, selectedTeam, lateThreshold, absentThreshold, earlyThreshold])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      await Promise.all([fetchRecords(), fetchStats(), fetchAlerts()])
    } catch {
      toast.error("获取出勤数据失败")
    } finally {
      setLoading(false)
    }
  }, [fetchRecords, fetchStats, fetchAlerts])

  useEffect(() => { fetchMeta() }, [fetchMeta])
  useEffect(() => { fetchAll() }, [fetchAll])

  // 汇总卡片数值
  const totalRecords = records.length
  const normalCount = records.filter((r) => r.status === "normal").length
  const lateCount = records.filter((r) => r.status === "late").length
  const absentCount = records.filter((r) => r.status === "absent").length

  async function handleAdd() {
    const res = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...addForm,
        checkIn: addForm.checkIn || undefined,
        checkOut: addForm.checkOut || undefined,
      }),
    })
    if (!res.ok) {
      const err = await res.json()
      toast.error(err.error ?? "创建失败")
      return
    }
    toast.success("出勤记录已添加")
    setAddOpen(false)
    setAddForm({ employeeId: "", date: "", checkIn: "", checkOut: "", status: "normal" })
    fetchAll()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">出勤统计</h2>
        <Button onClick={() => setAddOpen(true)} size="sm">
          <Plus className="mr-1 h-4 w-4" />
          录入出勤
        </Button>
      </div>

      {/* 筛选条 */}
      <div className="flex flex-wrap items-center gap-4">
        <Select value={selectedTeam} onValueChange={(v) => setSelectedTeam(v ?? "all")}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="全部班组">
              {selectedTeam !== "all" ? teams.find((t) => t.id === selectedTeam)?.name : "全部班组"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部班组</SelectItem>
            {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="w-40"
        />
      </div>

      {/* 汇总卡片 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">总记录</CardTitle>
            <BarChart3 className="h-4 w-4 text-zinc-400" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{totalRecords}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">正常出勤</CardTitle>
            <Clock className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-600">{normalCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">迟到</CardTitle>
            <ArrowDownLeft className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold text-amber-600">{lateCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">缺勤</CardTitle>
            <UserX className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold text-red-600">{absentCount}</p></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">数据看板</TabsTrigger>
          <TabsTrigger value="records">出勤明细</TabsTrigger>
          <TabsTrigger value="alerts">异常预警</TabsTrigger>
        </TabsList>

        {/* ========== 数据看板 ========== */}
        <TabsContent value="dashboard" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">月度员工出勤统计</CardTitle></CardHeader>
            <CardContent>
              {loading ? (
                <p className="py-8 text-center text-sm text-zinc-400">加载中…</p>
              ) : stats.length === 0 ? (
                <p className="py-8 text-center text-sm text-zinc-400">该月暂无出勤数据</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>员工</TableHead>
                      <TableHead>岗位</TableHead>
                      <TableHead className="text-center">总天数</TableHead>
                      <TableHead className="text-center">正常</TableHead>
                      <TableHead className="text-center">迟到</TableHead>
                      <TableHead className="text-center">早退</TableHead>
                      <TableHead className="text-center">缺勤</TableHead>
                      <TableHead className="text-center">出勤率</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.map((s) => {
                      const rate = s.totalDays > 0 ? Math.round((s.normalDays / s.totalDays) * 100) : 0
                      return (
                        <TableRow key={s.employeeId}>
                          <TableCell className="font-medium">{s.employeeName}</TableCell>
                          <TableCell className="text-zinc-500">{s.position}</TableCell>
                          <TableCell className="text-center">{s.totalDays}</TableCell>
                          <TableCell className="text-center text-green-600">{s.normalDays}</TableCell>
                          <TableCell className="text-center text-amber-600">{s.lateDays || "—"}</TableCell>
                          <TableCell className="text-center text-orange-500">{s.earlyDays || "—"}</TableCell>
                          <TableCell className="text-center text-red-600">{s.absentDays || "—"}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={rate >= 90 ? "default" : rate >= 70 ? "secondary" : "destructive"}>
                              {rate}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== 出勤明细 ========== */}
        <TabsContent value="records" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">出勤记录明细</CardTitle></CardHeader>
            <CardContent>
              {loading ? (
                <p className="py-8 text-center text-sm text-zinc-400">加载中…</p>
              ) : records.length === 0 ? (
                <p className="py-8 text-center text-sm text-zinc-400">暂无出勤记录</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>日期</TableHead>
                      <TableHead>员工</TableHead>
                      <TableHead>签到</TableHead>
                      <TableHead>签退</TableHead>
                      <TableHead className="text-center">状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((r) => {
                      const sc = statusConfig[r.status] ?? statusConfig.normal
                      return (
                        <TableRow key={r.id}>
                          <TableCell>{r.date}</TableCell>
                          <TableCell className="font-medium">{r.employee.name}</TableCell>
                          <TableCell>{r.checkIn ?? "—"}</TableCell>
                          <TableCell>{r.checkOut ?? "—"}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={sc.variant}>{sc.label}</Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== 异常预警 ========== */}
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4" />
                预警阈值配置
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">迟到阈值（次）</Label>
                  <Input
                    type="number" min={1} className="w-24"
                    value={lateThreshold}
                    onChange={(e) => setLateThreshold(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">缺勤阈值（次）</Label>
                  <Input
                    type="number" min={1} className="w-24"
                    value={absentThreshold}
                    onChange={(e) => setAbsentThreshold(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">早退阈值（次）</Label>
                  <Input
                    type="number" min={1} className="w-24"
                    value={earlyThreshold}
                    onChange={(e) => setEarlyThreshold(Number(e.target.value))}
                  />
                </div>
                <Button size="sm" onClick={fetchAlerts}>刷新预警</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">异常情况提醒</CardTitle></CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <p className="py-8 text-center text-sm text-zinc-400">本月暂无异常预警</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>员工</TableHead>
                      <TableHead>异常类型</TableHead>
                      <TableHead className="text-center">次数</TableHead>
                      <TableHead className="text-center">阈值</TableHead>
                      <TableHead className="text-center">状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alerts.map((a, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{a.employeeName}</TableCell>
                        <TableCell>{a.label}</TableCell>
                        <TableCell className="text-center font-semibold text-red-600">{a.count}</TableCell>
                        <TableCell className="text-center text-zinc-400">{a.threshold}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="destructive">超标</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ========== 录入出勤 Dialog ========== */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>录入出勤记录</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>员工</Label>
              <Select value={addForm.employeeId} onValueChange={(v) => setAddForm({ ...addForm, employeeId: v ?? "" })}>
                <SelectTrigger>
                  <SelectValue placeholder="请选择员工">
                    {addForm.employeeId ? employees.find((e) => e.id === addForm.employeeId)?.name : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>日期</Label>
              <Input type="date" value={addForm.date} onChange={(e) => setAddForm({ ...addForm, date: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>签到时间</Label>
                <Input type="time" value={addForm.checkIn} onChange={(e) => setAddForm({ ...addForm, checkIn: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>签退时间</Label>
                <Input type="time" value={addForm.checkOut} onChange={(e) => setAddForm({ ...addForm, checkOut: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>状态</Label>
              <Select value={addForm.status} onValueChange={(v) => setAddForm({ ...addForm, status: v ?? "normal" })}>
                <SelectTrigger>
                  <SelectValue>{statusConfig[addForm.status]?.label ?? "正常"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">正常</SelectItem>
                  <SelectItem value="late">迟到</SelectItem>
                  <SelectItem value="early">早退</SelectItem>
                  <SelectItem value="absent">缺勤</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>取消</Button>
            <Button onClick={handleAdd} disabled={!addForm.employeeId || !addForm.date}>
              录入
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
