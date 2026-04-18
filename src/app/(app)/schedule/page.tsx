"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

interface Team { id: string; name: string }
interface Employee { id: string; name: string; position: string; teamId: string }
interface Shift { id: string; code: string; name: string; startTime: string; endTime: string }
interface Schedule {
  id: string
  employeeId: string
  teamId: string
  shiftId: string
  shiftDate: string
  status: string
  note: string | null
  employee: { id: string; name: string; position: string }
  shift: { id: string; code: string; name: string; startTime: string; endTime: string }
}

const statusMap: Record<string, { label: string; color: "default" | "secondary" | "destructive" | "outline" }> = {
  scheduled: { label: "已排班", color: "default" },
  leave: { label: "请假", color: "secondary" },
  cancelled: { label: "已取消", color: "destructive" },
  completed: { label: "已完成", color: "outline" },
}

function getMonthDates(year: number, month: number): string[] {
  const lastDay = new Date(year, month, 0).getDate()
  return Array.from({ length: lastDay }, (_, i) => {
    const d = i + 1
    return `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`
  })
}

export default function SchedulePage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [selectedTeam, setSelectedTeam] = useState<string>("all")

  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth() + 1)
  const [loading, setLoading] = useState(true)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null)
  const [form, setForm] = useState({
    employeeId: "", teamId: "", shiftId: "", shiftDate: "", status: "scheduled", note: "",
  })

  const monthDates = useMemo(() => getMonthDates(currentYear, currentMonth), [currentYear, currentMonth])
  const monthLabel = `${currentYear}年${currentMonth}月`

  const fetchMeta = useCallback(async () => {
    const [tRes, eRes, sRes] = await Promise.all([
      fetch("/api/teams"), fetch("/api/employees"), fetch("/api/shifts"),
    ])
    setTeams(await tRes.json())
    setEmployees(await eRes.json())
    setShifts(await sRes.json())
  }, [])

  const fetchSchedules = useCallback(async () => {
    setLoading(true)
    try {
      const from = monthDates[0]
      const to = monthDates[monthDates.length - 1]
      const params = new URLSearchParams({ from, to })
      if (selectedTeam && selectedTeam !== "all") params.set("teamId", selectedTeam)
      const res = await fetch(`/api/schedules?${params}`)
      setSchedules(await res.json())
    } catch {
      toast.error("获取排班数据失败")
    } finally {
      setLoading(false)
    }
  }, [monthDates, selectedTeam])

  useEffect(() => { fetchMeta() }, [fetchMeta])
  useEffect(() => { fetchSchedules() }, [fetchSchedules])

  const filteredEmployees = useMemo(() => {
    if (!selectedTeam || selectedTeam === "all") return employees
    return employees.filter((e) => e.teamId === selectedTeam)
  }, [employees, selectedTeam])

  const scheduleMap = useMemo(() => {
    const map = new Map<string, Schedule[]>()
    for (const s of schedules) {
      const key = `${s.employeeId}_${s.shiftDate}`
      const arr = map.get(key) ?? []
      arr.push(s)
      map.set(key, arr)
    }
    return map
  }, [schedules])

  function prevMonth() {
    if (currentMonth === 1) { setCurrentYear((y) => y - 1); setCurrentMonth(12) }
    else setCurrentMonth((m) => m - 1)
  }
  function nextMonth() {
    if (currentMonth === 12) { setCurrentYear((y) => y + 1); setCurrentMonth(1) }
    else setCurrentMonth((m) => m + 1)
  }

  function openCreate(employeeId?: string, date?: string) {
    setEditingSchedule(null)
    const emp = employeeId ? employees.find((e) => e.id === employeeId) : undefined
    setForm({
      employeeId: employeeId ?? "",
      teamId: emp?.teamId ?? (selectedTeam !== "all" ? selectedTeam : ""),
      shiftId: "",
      shiftDate: date ?? monthDates[0],
      status: "scheduled",
      note: "",
    })
    setDialogOpen(true)
  }

  function openEdit(s: Schedule) {
    setEditingSchedule(s)
    setForm({
      employeeId: s.employeeId,
      teamId: s.teamId,
      shiftId: s.shiftId,
      shiftDate: s.shiftDate,
      status: s.status,
      note: s.note ?? "",
    })
    setDialogOpen(true)
  }

  async function handleSubmit() {
    const url = editingSchedule ? `/api/schedules/${editingSchedule.id}` : "/api/schedules"
    const method = editingSchedule ? "PATCH" : "POST"
    const body = editingSchedule
      ? { shiftId: form.shiftId, status: form.status, note: form.note || undefined }
      : { ...form, note: form.note || undefined }
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.json()
      toast.error(err.error ?? "操作失败")
      return
    }
    toast.success(editingSchedule ? "排班已更新" : "排班已创建")
    setDialogOpen(false)
    fetchSchedules()
  }

  async function handleDelete(s: Schedule) {
    if (!confirm("确定要删除该排班记录吗？")) return
    const res = await fetch(`/api/schedules/${s.id}`, { method: "DELETE" })
    if (!res.ok) {
      const err = await res.json()
      toast.error(err.error ?? "删除失败")
      return
    }
    toast.success("排班已删除")
    fetchSchedules()
  }

  const teamShifts = useMemo(() => shifts, [shifts])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">排班表</h2>
        <Button onClick={() => openCreate()} size="sm">
          <Plus className="mr-1 h-4 w-4" />
          新建排班
        </Button>
      </div>

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

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="min-w-[120px] text-center text-sm font-medium">{monthLabel}</span>
          <Button variant="outline" size="icon" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* ===== 月视图：按员工展示每日排班卡片 ===== */}
      {loading ? (
        <p className="py-8 text-center text-sm text-zinc-400">加载中…</p>
      ) : filteredEmployees.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-400">当前筛选条件下无员工</p>
      ) : (
        <div className="space-y-4">
          {filteredEmployees.map((emp) => (
            <Card key={emp.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span>{emp.name} <span className="font-normal text-zinc-400">({emp.position})</span></span>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openCreate(emp.id)}>
                    <Plus className="mr-0.5 h-3 w-3" />
                    排班
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto pb-3">
                <div className="grid auto-cols-[minmax(38px,1fr)] grid-flow-col gap-0.5" style={{ gridTemplateColumns: `repeat(${monthDates.length}, minmax(38px, 1fr))` }}>
                  {/* 日期头 */}
                  {monthDates.map((d) => {
                    const day = Number(d.slice(8))
                    const weekDay = new Date(d).getDay()
                    const isWeekend = weekDay === 0 || weekDay === 6
                    return (
                      <div key={d} className={`text-center text-[10px] leading-tight ${isWeekend ? "text-red-400" : "text-zinc-400"}`}>
                        {day}
                      </div>
                    )
                  })}
                  {/* 排班格 */}
                  {monthDates.map((date) => {
                    const items = scheduleMap.get(`${emp.id}_${date}`) ?? []
                    return (
                      <div key={date} className="flex min-h-[32px] flex-col items-center justify-center gap-0.5">
                        {items.length === 0 ? (
                          <button
                            onClick={() => openCreate(emp.id, date)}
                            className="h-full w-full rounded text-[10px] text-zinc-200 hover:bg-zinc-50 hover:text-zinc-400"
                          >
                            +
                          </button>
                        ) : (
                          items.map((s) => {
                            const st = statusMap[s.status] ?? statusMap.scheduled
                            return (
                              <div
                                key={s.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => openEdit(s)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault()
                                    openEdit(s)
                                  }
                                }}
                                className="group relative w-full cursor-pointer rounded border px-0.5 py-0.5 text-[10px] leading-tight transition-colors hover:bg-zinc-50"
                                title={`${s.shift.code} ${s.shift.startTime}-${s.shift.endTime} [${st.label}]\n点击编辑`}
                              >
                                <Badge variant={st.color} className="h-4 w-full justify-center text-[9px] leading-none">
                                  {s.shift.code.slice(0, 2)}
                                </Badge>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleDelete(s) }}
                                  className="absolute -right-1 -top-1 hidden rounded-full bg-white p-0.5 shadow group-hover:block"
                                >
                                  <Trash2 className="h-2.5 w-2.5 text-red-500" />
                                </button>
                              </div>
                            )
                          })
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ===== 新建/编辑 Dialog ===== */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSchedule ? "编辑排班" : "新建排班"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editingSchedule && (
              <>
                <div className="space-y-2">
                  <Label>班组</Label>
                  <Select value={form.teamId} onValueChange={(v) => setForm({ ...form, teamId: v ?? "", shiftId: "", employeeId: "" })}>
                    <SelectTrigger>
                      <SelectValue placeholder="请选择班组">
                        {form.teamId ? teams.find((t) => t.id === form.teamId)?.name : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>员工</Label>
                  <Select value={form.employeeId} onValueChange={(v) => setForm({ ...form, employeeId: v ?? "" })}>
                    <SelectTrigger>
                      <SelectValue placeholder="请选择员工">
                        {form.employeeId ? employees.find((e) => e.id === form.employeeId)?.name : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {employees.filter((e) => !form.teamId || e.teamId === form.teamId).map((e) => (
                        <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>日期</Label>
                  <Input type="date" value={form.shiftDate} onChange={(e) => setForm({ ...form, shiftDate: e.target.value })} />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>班次</Label>
              <Select value={form.shiftId} onValueChange={(v) => setForm({ ...form, shiftId: v ?? "" })}>
                <SelectTrigger>
                  <SelectValue placeholder="请选择班次">
                    {form.shiftId ? (() => { const s = teamShifts.find((x) => x.id === form.shiftId); return s ? `${s.code}（${s.startTime}–${s.endTime}）` : undefined })() : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {teamShifts.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.code}（{s.startTime}–{s.endTime}）</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>状态</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v ?? "scheduled" })}>
                <SelectTrigger>
                  <SelectValue>{statusMap[form.status]?.label ?? "已排班"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">已排班</SelectItem>
                  <SelectItem value="leave">请假</SelectItem>
                  <SelectItem value="cancelled">已取消</SelectItem>
                  <SelectItem value="completed">已完成</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>备注（可选）</Label>
              <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="备注信息" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button
              onClick={handleSubmit}
              disabled={editingSchedule ? !form.shiftId : (!form.employeeId || !form.teamId || !form.shiftId || !form.shiftDate)}
            >
              {editingSchedule ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
