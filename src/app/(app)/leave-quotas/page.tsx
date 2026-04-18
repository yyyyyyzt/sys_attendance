"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Save, Wallet, RefreshCw } from "lucide-react"
import { toast } from "sonner"

interface Employee { id: string; name: string; position: string; teamId: string }
interface Team { id: string; name: string }

const LEAVE_TYPES = [
  { value: "ANNUAL", label: "年假", hint: "消耗型，按工龄分配" },
  { value: "MARRIAGE", label: "婚假", hint: "消耗型，仅新婚员工" },
  { value: "CHILD_CARE", label: "育儿假", hint: "消耗型，按政策分配" },
  { value: "PATERNITY", label: "陪产假", hint: "上限型，默认不适用" },
  { value: "NURSING", label: "护理假", hint: "上限型" },
  { value: "BEREAVEMENT", label: "丧假", hint: "上限型 7 天" },
  { value: "SICK", label: "病假", hint: "上限型，按需覆盖" },
  { value: "PERSONAL", label: "事假", hint: "上限型，按需覆盖" },
] as const

const HOURS_PER_DAY = 8

interface BalanceItem {
  leaveType: string
  totalHours: number
  remainingHours: number
}

export default function LeaveQuotasPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [teamFilter, setTeamFilter] = useState<string>("all")
  const [year, setYear] = useState<number>(new Date().getFullYear())

  const [selectedEmpId, setSelectedEmpId] = useState<string>("")
  const [balances, setBalances] = useState<BalanceItem[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadMeta = useCallback(async () => {
    const [eRes, tRes] = await Promise.all([fetch("/api/employees"), fetch("/api/teams")])
    setEmployees(await eRes.json())
    setTeams(await tRes.json())
  }, [])

  useEffect(() => { loadMeta() }, [loadMeta])

  const visibleEmployees = useMemo(() => {
    if (teamFilter === "all") return employees
    return employees.filter((e) => e.teamId === teamFilter)
  }, [employees, teamFilter])

  const loadBalances = useCallback(async (empId: string, y: number) => {
    if (!empId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/employees/${empId}/leave-balances?year=${y}`)
      if (!res.ok) {
        toast.error("加载假期账户失败")
        setBalances([])
        return
      }
      const data = await res.json()
      setBalances(data.items ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedEmpId) loadBalances(selectedEmpId, year)
  }, [selectedEmpId, year, loadBalances])

  function handleChangeHours(leaveType: string, totalHours: number) {
    setBalances((prev) =>
      prev.map((b) =>
        b.leaveType === leaveType
          ? {
              ...b,
              totalHours,
              remainingHours: Math.min(b.remainingHours, totalHours),
            }
          : b,
      ),
    )
  }
  function handleChangeRemaining(leaveType: string, remainingHours: number) {
    setBalances((prev) =>
      prev.map((b) =>
        b.leaveType === leaveType ? { ...b, remainingHours: Math.min(remainingHours, b.totalHours) } : b,
      ),
    )
  }

  async function handleSave() {
    if (!selectedEmpId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/employees/${selectedEmpId}/leave-balances`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, items: balances }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error ?? "保存失败")
        return
      }
      toast.success("已保存")
      await loadBalances(selectedEmpId, year)
    } finally {
      setSaving(false)
    }
  }

  async function handleBatchReset() {
    if (!selectedEmpId) return
    if (!confirm("将该员工本年度所有假期额度清零？不会影响已批准的请假记录。")) return
    setBalances((prev) => prev.map((b) => ({ ...b, totalHours: 0, remainingHours: 0 })))
  }

  const selectedEmp = employees.find((e) => e.id === selectedEmpId) ?? null
  const teamOfSelected = selectedEmp ? teams.find((t) => t.id === selectedEmp.teamId) : null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          <div>
            <h2 className="text-2xl font-bold tracking-tight">假期额度管理</h2>
            <p className="text-xs text-zinc-500">
              每个员工单独维护假期额度；默认所有类型为 0，需要时再分配。
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm">年度</Label>
          <Input
            type="number"
            value={year}
            min={2000}
            max={2100}
            onChange={(e) => setYear(Number(e.target.value) || year)}
            className="w-24"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        {/* 左侧：班组 + 员工列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">选择员工</CardTitle>
            <CardDescription>按班组筛选，点击员工查看/编辑</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Select value={teamFilter} onValueChange={(v) => setTeamFilter(v ?? "all")}>
              <SelectTrigger>
                <SelectValue>
                  {teamFilter === "all"
                    ? "全部班组"
                    : teams.find((t) => t.id === teamFilter)?.name ?? "全部班组"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部班组</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="max-h-[60vh] overflow-y-auto">
              {visibleEmployees.length === 0 ? (
                <p className="py-6 text-center text-sm text-zinc-400">暂无员工</p>
              ) : (
                <ul className="space-y-1">
                  {visibleEmployees.map((e) => {
                    const team = teams.find((t) => t.id === e.teamId)
                    const active = selectedEmpId === e.id
                    return (
                      <li key={e.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedEmpId(e.id)}
                          className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                            active
                              ? "bg-zinc-900 text-white"
                              : "hover:bg-zinc-100 text-zinc-700"
                          }`}
                        >
                          <span>{e.name}</span>
                          <span className={`text-[11px] ${active ? "text-zinc-300" : "text-zinc-400"}`}>
                            {team?.name ?? ""}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 右侧：额度编辑 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">
                {selectedEmp ? selectedEmp.name : "请先选择员工"}
              </CardTitle>
              {selectedEmp && (
                <CardDescription>
                  {teamOfSelected?.name ?? "未分组"} · {selectedEmp.position} · {year} 年度
                </CardDescription>
              )}
            </div>
            {selectedEmp && (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={handleBatchReset} disabled={saving}>
                  <RefreshCw className="mr-1 h-3.5 w-3.5" />
                  清零
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving || loading}>
                  <Save className="mr-1 h-3.5 w-3.5" />
                  {saving ? "保存中…" : "保存"}
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {!selectedEmpId ? (
              <p className="py-12 text-center text-sm text-zinc-400">
                从左侧选择一个员工，即可查看和编辑他的假期额度
              </p>
            ) : loading ? (
              <p className="py-8 text-center text-sm text-zinc-400">加载中…</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>假期类型</TableHead>
                    <TableHead className="w-36 text-center">年度总额（天）</TableHead>
                    <TableHead className="w-36 text-center">剩余可用（天）</TableHead>
                    <TableHead className="w-24 text-center">状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {LEAVE_TYPES.map((lt) => {
                    const b = balances.find((x) => x.leaveType === lt.value) ?? {
                      leaveType: lt.value,
                      totalHours: 0,
                      remainingHours: 0,
                    }
                    const totalDays = b.totalHours / HOURS_PER_DAY
                    const remainDays = b.remainingHours / HOURS_PER_DAY
                    return (
                      <TableRow key={lt.value}>
                        <TableCell>
                          <div className="font-medium">{lt.label}</div>
                          <div className="text-[11px] text-zinc-400">{lt.hint}</div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            min={0}
                            step={0.5}
                            value={totalDays}
                            onChange={(e) => {
                              const days = Number(e.target.value)
                              if (Number.isFinite(days) && days >= 0) {
                                handleChangeHours(lt.value, days * HOURS_PER_DAY)
                              }
                            }}
                            className="mx-auto h-8 w-20 text-center"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            min={0}
                            step={0.5}
                            value={remainDays}
                            onChange={(e) => {
                              const days = Number(e.target.value)
                              if (Number.isFinite(days) && days >= 0) {
                                handleChangeRemaining(lt.value, days * HOURS_PER_DAY)
                              }
                            }}
                            className="mx-auto h-8 w-20 text-center"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          {b.totalHours === 0 ? (
                            <Badge variant="outline" className="text-[10px]">不适用</Badge>
                          ) : b.remainingHours === 0 ? (
                            <Badge variant="destructive" className="text-[10px]">已用完</Badge>
                          ) : (
                            <Badge variant="default" className="text-[10px]">可用</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
