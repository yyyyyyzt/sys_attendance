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
import { Plus, Check, X, Trash2, AlertTriangle, UserPlus } from "lucide-react"
import { toast } from "sonner"

interface Employee { id: string; name: string; position: string; teamId: string }
interface Team { id: string; name: string }
interface LeaveRequest {
  id: string
  employeeId: string
  startDate: string
  endDate: string
  reason: string
  status: string
  approverId: string | null
  createdAt: string
  employee: { id: string; name: string; position: string; teamId: string }
}
interface GapInfo {
  shiftDate: string
  shiftId: string
  shiftName: string
  teamId: string
  teamName: string
  requiredCount: number
  currentCount: number
  gap: number
}
interface SubstituteCandidate {
  id: string
  name: string
  position: string
  skills: string[]
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "待审批", variant: "secondary" },
  approved: { label: "已通过", variant: "default" },
  rejected: { label: "已拒绝", variant: "destructive" },
}

export default function LeavesPage() {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState("all")

  const [applyOpen, setApplyOpen] = useState(false)
  const [applyForm, setApplyForm] = useState({ employeeId: "", startDate: "", endDate: "", reason: "" })

  const [gaps, setGaps] = useState<GapInfo[]>([])
  const [gapTeam, setGapTeam] = useState("")
  const [gapFrom, setGapFrom] = useState("")
  const [gapTo, setGapTo] = useState("")
  const [gapLoading, setGapLoading] = useState(false)

  const [subsOpen, setSubsOpen] = useState(false)
  const [subsTarget, setSubsTarget] = useState<GapInfo | null>(null)
  const [substitutes, setSubstitutes] = useState<SubstituteCandidate[]>([])

  const fetchLeaves = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterStatus && filterStatus !== "all") params.set("status", filterStatus)
      const res = await fetch(`/api/leaves?${params}`)
      setLeaves(await res.json())
    } catch {
      toast.error("获取请假列表失败")
    } finally {
      setLoading(false)
    }
  }, [filterStatus])

  const fetchMeta = useCallback(async () => {
    const [eRes, tRes] = await Promise.all([fetch("/api/employees"), fetch("/api/teams")])
    setEmployees(await eRes.json())
    setTeams(await tRes.json())
  }, [])

  useEffect(() => { fetchMeta() }, [fetchMeta])
  useEffect(() => { fetchLeaves() }, [fetchLeaves])

  async function handleApply() {
    const res = await fetch("/api/leaves", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(applyForm),
    })
    if (!res.ok) {
      const err = await res.json()
      toast.error(err.error ?? "提交失败")
      return
    }
    toast.success("请假申请已提交")
    setApplyOpen(false)
    setApplyForm({ employeeId: "", startDate: "", endDate: "", reason: "" })
    fetchLeaves()
  }

  async function handleApprove(id: string, status: "approved" | "rejected") {
    const res = await fetch(`/api/leaves/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, approverId: "admin" }),
    })
    if (!res.ok) {
      const err = await res.json()
      toast.error(err.error ?? "审批失败")
      return
    }
    toast.success(status === "approved" ? "已批准" : "已拒绝")
    fetchLeaves()
  }

  async function handleDelete(id: string) {
    if (!confirm("确定要删除该请假记录吗？")) return
    const res = await fetch(`/api/leaves/${id}`, { method: "DELETE" })
    if (!res.ok) {
      toast.error("删除失败")
      return
    }
    toast.success("已删除")
    fetchLeaves()
  }

  async function handleDetectGaps() {
    if (!gapTeam || !gapFrom || !gapTo) {
      toast.error("请选择班组与日期范围")
      return
    }
    setGapLoading(true)
    try {
      const params = new URLSearchParams({ teamId: gapTeam, from: gapFrom, to: gapTo })
      const res = await fetch(`/api/leaves/gaps?${params}`)
      const data = await res.json()
      setGaps(data)
      if (Array.isArray(data) && data.length === 0) toast.success("该范围内无人员缺口")
    } catch {
      toast.error("缺口检测失败")
    } finally {
      setGapLoading(false)
    }
  }

  async function openSubstitutes(gap: GapInfo) {
    setSubsTarget(gap)
    setSubsOpen(true)
    try {
      const params = new URLSearchParams({ teamId: gap.teamId, shiftDate: gap.shiftDate, shiftId: gap.shiftId })
      const res = await fetch(`/api/leaves/substitutes?${params}`)
      setSubstitutes(await res.json())
    } catch {
      toast.error("获取替补推荐失败")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">请假管理</h2>
        <Button onClick={() => setApplyOpen(true)} size="sm">
          <Plus className="mr-1 h-4 w-4" />
          提交请假
        </Button>
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">请假列表</TabsTrigger>
          <TabsTrigger value="gaps">缺口预警</TabsTrigger>
        </TabsList>

        {/* ========== 请假列表 ========== */}
        <TabsContent value="list" className="space-y-4">
          <div className="flex items-center gap-2">
            <Label className="text-sm text-zinc-500">状态筛选</Label>
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v ?? "all")}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="全部">
                  {filterStatus !== "all" ? (statusConfig[filterStatus]?.label ?? filterStatus) : "全部"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="pending">待审批</SelectItem>
                <SelectItem value="approved">已通过</SelectItem>
                <SelectItem value="rejected">已拒绝</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">请假记录</CardTitle></CardHeader>
            <CardContent>
              {loading ? (
                <p className="py-8 text-center text-sm text-zinc-400">加载中…</p>
              ) : leaves.length === 0 ? (
                <p className="py-8 text-center text-sm text-zinc-400">暂无请假记录</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>员工</TableHead>
                      <TableHead>起止日期</TableHead>
                      <TableHead>原因</TableHead>
                      <TableHead className="w-24 text-center">状态</TableHead>
                      <TableHead className="w-32 text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaves.map((l) => {
                      const sc = statusConfig[l.status] ?? statusConfig.pending
                      return (
                        <TableRow key={l.id}>
                          <TableCell className="font-medium">{l.employee.name}</TableCell>
                          <TableCell>{l.startDate} ~ {l.endDate}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-zinc-500">{l.reason}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={sc.variant}>{sc.label}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {l.status === "pending" && (
                                <>
                                  <Button variant="ghost" size="icon" title="批准" onClick={() => handleApprove(l.id, "approved")}>
                                    <Check className="h-4 w-4 text-green-600" />
                                  </Button>
                                  <Button variant="ghost" size="icon" title="拒绝" onClick={() => handleApprove(l.id, "rejected")}>
                                    <X className="h-4 w-4 text-red-500" />
                                  </Button>
                                </>
                              )}
                              <Button variant="ghost" size="icon" title="删除" onClick={() => handleDelete(l.id)}>
                                <Trash2 className="h-4 w-4 text-zinc-400" />
                              </Button>
                            </div>
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

        {/* ========== 缺口预警 ========== */}
        <TabsContent value="gaps" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4" />
                人员缺口检测
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-2">
                  <Label>班组</Label>
                  <Select value={gapTeam} onValueChange={(v) => setGapTeam(v ?? "")}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="请选择班组">
                        {gapTeam ? teams.find((t) => t.id === gapTeam)?.name : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>开始日期</Label>
                  <Input type="date" value={gapFrom} onChange={(e) => setGapFrom(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>结束日期</Label>
                  <Input type="date" value={gapTo} onChange={(e) => setGapTo(e.target.value)} />
                </div>
                <Button onClick={handleDetectGaps} disabled={gapLoading}>
                  {gapLoading ? "检测中…" : "开始检测"}
                </Button>
              </div>

              {gaps.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>日期</TableHead>
                      <TableHead>班次</TableHead>
                      <TableHead className="text-center">需要人数</TableHead>
                      <TableHead className="text-center">当前人数</TableHead>
                      <TableHead className="text-center">缺口</TableHead>
                      <TableHead className="w-24 text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gaps.map((g, i) => (
                      <TableRow key={i}>
                        <TableCell>{g.shiftDate}</TableCell>
                        <TableCell className="font-medium">{g.shiftName}</TableCell>
                        <TableCell className="text-center">{g.requiredCount}</TableCell>
                        <TableCell className="text-center">{g.currentCount}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="destructive">缺 {g.gap} 人</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => openSubstitutes(g)}>
                            <UserPlus className="mr-1 h-3 w-3" />
                            推荐替补
                          </Button>
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

      {/* ========== 请假申请 Dialog ========== */}
      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>提交请假申请</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>员工</Label>
              <Select value={applyForm.employeeId} onValueChange={(v) => setApplyForm({ ...applyForm, employeeId: v ?? "" })}>
                <SelectTrigger>
                  <SelectValue placeholder="请选择员工">
                    {applyForm.employeeId ? employees.find((e) => e.id === applyForm.employeeId)?.name : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>开始日期</Label>
                <Input type="date" value={applyForm.startDate} onChange={(e) => setApplyForm({ ...applyForm, startDate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>结束日期</Label>
                <Input type="date" value={applyForm.endDate} onChange={(e) => setApplyForm({ ...applyForm, endDate: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>请假原因</Label>
              <Input
                value={applyForm.reason}
                onChange={(e) => setApplyForm({ ...applyForm, reason: e.target.value })}
                placeholder="请输入请假原因"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyOpen(false)}>取消</Button>
            <Button
              onClick={handleApply}
              disabled={!applyForm.employeeId || !applyForm.startDate || !applyForm.endDate || !applyForm.reason.trim()}
            >
              提交申请
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== 替补推荐 Dialog ========== */}
      <Dialog open={subsOpen} onOpenChange={setSubsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              替补推荐 — {subsTarget?.shiftDate} {subsTarget?.shiftName}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {substitutes.length === 0 ? (
              <p className="py-4 text-center text-sm text-zinc-400">暂无可用替补人员</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>姓名</TableHead>
                    <TableHead>岗位</TableHead>
                    <TableHead>技能</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {substitutes.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.position}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {s.skills.map((sk) => (
                            <Badge key={sk} variant="secondary" className="text-xs">{sk}</Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubsOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
