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
import { Plus, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { jsonToStringArray } from "@/lib/json-array"

interface Team {
  id: string
  name: string
}

interface Employee {
  id: string
  name: string
  teamId: string
  position: string
  skills: unknown
  status: string
  team: Team
}

const emptyForm = { name: "", teamId: "", position: "", skills: "", status: "active" }

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [filterTeam, setFilterTeam] = useState<string>("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [form, setForm] = useState(emptyForm)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [empRes, teamRes] = await Promise.all([
        fetch(filterTeam && filterTeam !== "all" ? `/api/employees?teamId=${filterTeam}` : "/api/employees"),
        fetch("/api/teams"),
      ])
      setEmployees(await empRes.json())
      setTeams(await teamRes.json())
    } catch {
      toast.error("获取数据失败")
    } finally {
      setLoading(false)
    }
  }, [filterTeam])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(emp: Employee) {
    setEditing(emp)
    setForm({
      name: emp.name,
      teamId: emp.teamId,
      position: emp.position,
      skills: jsonToStringArray(emp.skills).join("、"),
      status: emp.status as "active" | "inactive",
    })
    setDialogOpen(true)
  }

  async function handleSubmit() {
    const skillsArr = form.skills
      .split(/[,，、\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    const payload = {
      name: form.name,
      teamId: form.teamId,
      position: form.position,
      skills: skillsArr,
      status: form.status,
    }
    const url = editing ? `/api/employees/${editing.id}` : "/api/employees"
    const method = editing ? "PATCH" : "POST"
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json()
      toast.error(err.error ?? "操作失败")
      return
    }
    toast.success(editing ? "员工已更新" : "员工已创建")
    setDialogOpen(false)
    fetchData()
  }

  async function handleDelete(emp: Employee) {
    if (!confirm(`确定要删除员工「${emp.name}」吗？`)) return
    const res = await fetch(`/api/employees/${emp.id}`, { method: "DELETE" })
    if (!res.ok) {
      const err = await res.json()
      toast.error(err.error ?? "删除失败")
      return
    }
    toast.success("员工已删除")
    fetchData()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">员工管理</h2>
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-1 h-4 w-4" />
          新建员工
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Label className="text-sm text-zinc-500">按班组筛选</Label>
        <Select value={filterTeam} onValueChange={(v) => setFilterTeam(v ?? "all")}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="全部班组">
              {filterTeam !== "all" ? teams.find((t) => t.id === filterTeam)?.name : "全部班组"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部班组</SelectItem>
            {teams.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">员工列表</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-zinc-400">加载中…</p>
          ) : employees.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-400">暂无员工</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>姓名</TableHead>
                  <TableHead>班组</TableHead>
                  <TableHead>岗位</TableHead>
                  <TableHead>技能</TableHead>
                  <TableHead className="w-20 text-center">状态</TableHead>
                  <TableHead className="w-24 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">{emp.name}</TableCell>
                    <TableCell>{emp.team.name}</TableCell>
                    <TableCell>{emp.position}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {jsonToStringArray(emp.skills).map((s) => (
                          <Badge key={s} variant="secondary" className="text-xs">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={emp.status === "active" ? "default" : "secondary"}>
                        {emp.status === "active" ? "在职" : "离职"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(emp)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(emp)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "编辑员工" : "新建员工"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>姓名</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="请输入员工姓名"
              />
            </div>
            <div className="space-y-2">
              <Label>班组</Label>
              <Select value={form.teamId} onValueChange={(v) => setForm({ ...form, teamId: v ?? "" })}>
                <SelectTrigger>
                  <SelectValue placeholder="请选择班组">
                    {form.teamId ? teams.find((t) => t.id === form.teamId)?.name : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>岗位</Label>
              <Input
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
                placeholder="请输入岗位"
              />
            </div>
            <div className="space-y-2">
              <Label>技能（用逗号或顿号分隔）</Label>
              <Input
                value={form.skills}
                onChange={(e) => setForm({ ...form, skills: e.target.value })}
                placeholder="例如：售前、售后、投诉处理"
              />
            </div>
            <div className="space-y-2">
              <Label>状态</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v ?? "active" })}>
                <SelectTrigger>
                  <SelectValue>{form.status === "active" ? "在职" : "离职"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">在职</SelectItem>
                  <SelectItem value="inactive">离职</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSubmit} disabled={!form.name.trim() || !form.teamId || !form.position.trim()}>
              {editing ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
