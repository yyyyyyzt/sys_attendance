"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"

interface Team {
  id: string
  name: string
  description: string | null
  createdAt: string
  _count: { employees: number }
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Team | null>(null)
  const [form, setForm] = useState({ name: "", description: "" })

  const fetchTeams = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/teams")
      const data = await res.json()
      setTeams(data)
    } catch {
      toast.error("获取班组列表失败")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTeams()
  }, [fetchTeams])

  function openCreate() {
    setEditing(null)
    setForm({ name: "", description: "" })
    setDialogOpen(true)
  }

  function openEdit(team: Team) {
    setEditing(team)
    setForm({ name: team.name, description: team.description ?? "" })
    setDialogOpen(true)
  }

  async function handleSubmit() {
    const url = editing ? `/api/teams/${editing.id}` : "/api/teams"
    const method = editing ? "PATCH" : "POST"
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        description: form.description || undefined,
      }),
    })
    if (!res.ok) {
      const err = await res.json()
      toast.error(err.error ?? "操作失败")
      return
    }
    toast.success(editing ? "班组已更新" : "班组已创建")
    setDialogOpen(false)
    fetchTeams()
  }

  async function handleDelete(team: Team) {
    if (!confirm(`确定要删除班组「${team.name}」吗？`)) return
    const res = await fetch(`/api/teams/${team.id}`, { method: "DELETE" })
    if (!res.ok) {
      const err = await res.json()
      toast.error(err.error ?? "删除失败")
      return
    }
    toast.success("班组已删除")
    fetchTeams()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">班组管理</h2>
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-1 h-4 w-4" />
          新建班组
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">全部班组</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-zinc-400">加载中…</p>
          ) : teams.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-400">暂无班组，请点击右上角新建</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>班组名称</TableHead>
                  <TableHead>描述</TableHead>
                  <TableHead className="w-24 text-center">员工数</TableHead>
                  <TableHead className="w-24 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((team) => (
                  <TableRow key={team.id}>
                    <TableCell className="font-medium">{team.name}</TableCell>
                    <TableCell className="text-zinc-500">
                      {team.description || "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {team._count.employees}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(team)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(team)}
                        >
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
            <DialogTitle>{editing ? "编辑班组" : "新建班组"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="name">班组名称</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="请输入班组名称"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">描述（可选）</Label>
              <Input
                id="desc"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="班组描述"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={!form.name.trim()}>
              {editing ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
