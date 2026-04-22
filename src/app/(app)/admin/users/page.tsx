"use client"

import { useCallback, useEffect, useState } from "react"
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Plus, RefreshCw, Trash2, Link2, Copy, Shield } from "lucide-react"
import { toast } from "sonner"

type Role = "LEADER" | "MANAGER" | "ADMIN"

interface Team { id: string; name: string }
interface AppUserRow {
  id: string
  name: string
  role: Role
  teamId: string | null
  teamName: string | null
  magicToken: string
  disabled: boolean
  createdAt: string
  updatedAt: string
}

const ROLE_LABEL: Record<Role, string> = {
  LEADER: "班长",
  MANAGER: "总经理",
  ADMIN: "管理员",
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AppUserRow[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)

  const [origin, setOrigin] = useState<string>("")
  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin)
  }, [])

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState<{ name: string; role: Role; teamId: string }>({
    name: "",
    role: "LEADER",
    teamId: "",
  })

  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUser, setLinkUser] = useState<AppUserRow | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [uRes, tRes] = await Promise.all([fetch("/api/auth/users"), fetch("/api/teams")])
      if (!uRes.ok) {
        const err = await uRes.json().catch(() => ({}))
        toast.error(err.error ?? "获取用户失败")
        return
      }
      setUsers(await uRes.json())
      setTeams(await tRes.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  function buildMagicUrl(token: string): string {
    return `${origin || ""}/?t=${encodeURIComponent(token)}`
  }

  async function handleCreate() {
    if (!form.name.trim()) return toast.error("请输入姓名")
    if (form.role === "LEADER" && !form.teamId) return toast.error("班长必须绑定班组")
    const res = await fetch("/api/auth/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        role: form.role,
        teamId: form.teamId || null,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error ?? "创建失败")
      return
    }
    const created: AppUserRow = await res.json()
    toast.success("已创建")
    setCreateOpen(false)
    setForm({ name: "", role: "LEADER", teamId: "" })
    await fetchAll()
    setLinkUser(created)
    setLinkOpen(true)
  }

  async function handleResetToken(u: AppUserRow) {
    if (!confirm(`重置 ${u.name} 的登录链接？旧链接立即失效。`)) return
    const res = await fetch(`/api/auth/users/${u.id}/reset-token`, { method: "POST" })
    if (!res.ok) {
      toast.error("重置失败")
      return
    }
    const data = await res.json()
    toast.success("已重置，请把新链接发给用户")
    await fetchAll()
    setLinkUser({ ...u, magicToken: data.magicToken })
    setLinkOpen(true)
  }

  async function handleToggleDisabled(u: AppUserRow) {
    const res = await fetch(`/api/auth/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disabled: !u.disabled }),
    })
    if (!res.ok) {
      toast.error("更新失败")
      return
    }
    toast.success(u.disabled ? "已启用" : "已禁用")
    fetchAll()
  }

  async function handleDelete(u: AppUserRow) {
    if (!confirm(`确定删除用户 ${u.name}？`)) return
    const res = await fetch(`/api/auth/users/${u.id}`, { method: "DELETE" })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error ?? "删除失败")
      return
    }
    toast.success("已删除")
    fetchAll()
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success("已复制")
    } catch {
      toast.error("复制失败，请手动选中")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          <div>
            <h2 className="text-2xl font-bold tracking-tight">用户管理</h2>
            <p className="text-xs text-zinc-500">
              给班长 / 总经理生成专属链接登录，链接丢失可随时重置。
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          新增用户
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">用户列表</CardTitle>
          <CardDescription>{users.length} 个用户</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-zinc-400">加载中…</p>
          ) : users.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-400">暂无用户</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>姓名</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>班组</TableHead>
                  <TableHead>Token 片段</TableHead>
                  <TableHead className="text-center">状态</TableHead>
                  <TableHead className="w-56 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === "ADMIN" ? "destructive" : u.role === "MANAGER" ? "default" : "secondary"}>
                        {ROLE_LABEL[u.role]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-zinc-500">{u.teamName ?? "—"}</TableCell>
                    <TableCell className="font-mono text-[11px] text-zinc-400">
                      {u.magicToken.slice(0, 12)}…
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={u.disabled ? "outline" : "default"}>
                        {u.disabled ? "已禁用" : "启用中"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setLinkUser(u); setLinkOpen(true) }}>
                          <Link2 className="mr-0.5 h-3 w-3" />
                          链接
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleResetToken(u)}>
                          <RefreshCw className="mr-0.5 h-3 w-3" />
                          重置
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleToggleDisabled(u)}>
                          {u.disabled ? "启用" : "禁用"}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleDelete(u)}>
                          <Trash2 className="h-3 w-3 text-red-500" />
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

      {/* 新增用户 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>新增用户</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>姓名</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如：黄菊" />
            </div>
            <div className="space-y-2">
              <Label>角色</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Role })}>
                <SelectTrigger>
                  <SelectValue>{ROLE_LABEL[form.role]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LEADER">班长</SelectItem>
                  <SelectItem value="MANAGER">总经理</SelectItem>
                  <SelectItem value="ADMIN">管理员</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.role === "LEADER" && (
              <div className="space-y-2">
                <Label>所在班组</Label>
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
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button onClick={handleCreate}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 查看/复制链接 */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>登录链接</DialogTitle></DialogHeader>
          {linkUser && (
            <div className="space-y-3 py-2">
              <p className="text-sm text-zinc-600">
                把下方链接发给 <b>{linkUser.name}</b>（{ROLE_LABEL[linkUser.role]}），
                对方点开即自动登录，之后就可以用普通网址访问。
              </p>
              <div className="rounded-md border bg-zinc-50 p-3 font-mono text-xs break-all">
                {buildMagicUrl(linkUser.magicToken)}
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => copyToClipboard(buildMagicUrl(linkUser.magicToken))}>
                  <Copy className="mr-1 h-3 w-3" />
                  复制链接
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleResetToken(linkUser)}>
                  <RefreshCw className="mr-1 h-3 w-3" />
                  重置生成新链接
                </Button>
              </div>
              <p className="text-[11px] text-zinc-400">
                提示：后期接入微信扫码登录后，可直接扫码无感进入，无需再发链接。
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
