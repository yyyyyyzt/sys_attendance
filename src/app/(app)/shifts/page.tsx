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

interface Team { id: string; name: string }
interface Shift {
  id: string
  name: string
  startTime: string
  endTime: string
  isCrossDay: boolean
  requiredCount: number
  teamId: string
  team: Team
}

const emptyForm = {
  name: "",
  startTime: "",
  endTime: "",
  isCrossDay: false,
  requiredCount: 1,
  teamId: "",
}

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Shift | null>(null)
  const [form, setForm] = useState(emptyForm)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [shiftRes, teamRes] = await Promise.all([
        fetch("/api/shifts"),
        fetch("/api/teams"),
      ])
      setShifts(await shiftRes.json())
      setTeams(await teamRes.json())
    } catch {
      toast.error("获取数据失败")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(shift: Shift) {
    setEditing(shift)
    setForm({
      name: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
      isCrossDay: shift.isCrossDay,
      requiredCount: shift.requiredCount,
      teamId: shift.teamId,
    })
    setDialogOpen(true)
  }

  async function handleSubmit() {
    const payload = { ...form, requiredCount: Number(form.requiredCount) }
    const url = editing ? `/api/shifts/${editing.id}` : "/api/shifts"
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
    toast.success(editing ? "班次已更新" : "班次已创建")
    setDialogOpen(false)
    fetchData()
  }

  async function handleDelete(shift: Shift) {
    if (!confirm(`确定要删除班次「${shift.name}」吗？`)) return
    const res = await fetch(`/api/shifts/${shift.id}`, { method: "DELETE" })
    if (!res.ok) {
      const err = await res.json()
      toast.error(err.error ?? "删除失败")
      return
    }
    toast.success("班次已删除")
    fetchData()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">班次配置</h2>
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-1 h-4 w-4" />
          新建班次
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">全部班次</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-zinc-400">加载中…</p>
          ) : shifts.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-400">暂无班次</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>班次名称</TableHead>
                  <TableHead>班组</TableHead>
                  <TableHead>时间</TableHead>
                  <TableHead className="w-20 text-center">跨天</TableHead>
                  <TableHead className="w-24 text-center">最少人数</TableHead>
                  <TableHead className="w-24 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.team.name}</TableCell>
                    <TableCell>{s.startTime} – {s.endTime}</TableCell>
                    <TableCell className="text-center">
                      {s.isCrossDay ? <Badge>是</Badge> : <span className="text-zinc-400">否</span>}
                    </TableCell>
                    <TableCell className="text-center">{s.requiredCount}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(s)}>
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
            <DialogTitle>{editing ? "编辑班次" : "新建班次"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>班次名称</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="例如：早班" />
            </div>
            <div className="space-y-2">
              <Label>所属班组</Label>
              <Select value={form.teamId} onValueChange={(v) => setForm({ ...form, teamId: v ?? "" })}>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>开始时间</Label>
                <Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>结束时间</Label>
                <Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>最少人数</Label>
                <Input type="number" min={1} value={form.requiredCount} onChange={(e) => setForm({ ...form, requiredCount: Number(e.target.value) })} />
              </div>
              <div className="flex items-end gap-2 pb-0.5">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.isCrossDay}
                    onChange={(e) => setForm({ ...form, isCrossDay: e.target.checked })}
                    className="h-4 w-4 rounded border-zinc-300"
                  />
                  跨天班次
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSubmit} disabled={!form.name.trim() || !form.teamId || !form.startTime || !form.endTime}>
              {editing ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
