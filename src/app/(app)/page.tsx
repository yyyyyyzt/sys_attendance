"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Building2, Users, Clock, CalendarDays, ClipboardList, BarChart3 } from "lucide-react"
import Link from "next/link"

interface StatsData {
  teamCount: number
  employeeCount: number
  shiftCount: number
  pendingLeaves: number
  todaySchedules: number
  todayAlerts: number
}

const quickLinks = [
  { href: "/teams", label: "班组管理", desc: "管理班组信息", icon: Building2 },
  { href: "/employees", label: "员工管理", desc: "管理员工档案", icon: Users },
  { href: "/shifts", label: "班次配置", desc: "配置班次模板", icon: Clock },
  { href: "/schedule", label: "排班表", desc: "查看与编辑排班", icon: CalendarDays },
  { href: "/leaves", label: "请假管理", desc: "请假申请与审批", icon: ClipboardList },
  { href: "/attendance", label: "出勤统计", desc: "出勤监控看板", icon: BarChart3 },
]

export default function DashboardPage() {
  const [stats, setStats] = useState<StatsData | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [teamsRes, empsRes, shiftsRes, leavesRes, schedRes] = await Promise.all([
          fetch("/api/teams"),
          fetch("/api/employees"),
          fetch("/api/shifts"),
          fetch("/api/leaves?status=pending"),
          fetch(`/api/schedules?from=${todayStr()}&to=${todayStr()}`),
        ])
        const teams = await teamsRes.json()
        const emps = await empsRes.json()
        const shifts = await shiftsRes.json()
        const leaves = await leavesRes.json()
        const scheds = await schedRes.json()
        if (!cancelled) {
          setStats({
            teamCount: Array.isArray(teams) ? teams.length : 0,
            employeeCount: Array.isArray(emps) ? emps.length : 0,
            shiftCount: Array.isArray(shifts) ? shifts.length : 0,
            pendingLeaves: Array.isArray(leaves) ? leaves.length : 0,
            todaySchedules: Array.isArray(scheds) ? scheds.length : 0,
            todayAlerts: 0,
          })
        }
      } catch { /* 静默 */ }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">工作台</h2>
        <p className="text-sm text-zinc-500">欢迎使用智能排班考勤小助手</p>
      </div>

      {/* 实时统计卡片 */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="班组" value={stats?.teamCount} icon={Building2} href="/teams" />
        <StatCard label="员工" value={stats?.employeeCount} icon={Users} href="/employees" />
        <StatCard label="班次" value={stats?.shiftCount} icon={Clock} href="/shifts" />
        <StatCard label="今日排班" value={stats?.todaySchedules} icon={CalendarDays} href="/schedule" />
        <StatCard label="待审假条" value={stats?.pendingLeaves} icon={ClipboardList} href="/leaves" highlight={!!stats && stats.pendingLeaves > 0} />
        <StatCard label="出勤异常" value={stats?.todayAlerts} icon={BarChart3} href="/attendance" />
      </div>

      {/* 快捷入口 */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-zinc-500">快捷入口</h3>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((item) => {
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardHeader className="flex flex-row items-center gap-3 pb-2">
                    <Icon className="h-5 w-5 text-zinc-500" />
                    <CardTitle className="text-sm md:text-base">{item.label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-zinc-500 md:text-sm">{item.desc}</p>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label, value, icon: Icon, href, highlight,
}: {
  label: string
  value: number | undefined
  icon: React.ComponentType<{ className?: string }>
  href: string
  highlight?: boolean
}) {
  return (
    <Link href={href}>
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="flex items-center gap-3 p-3 md:p-4">
          <Icon className="h-5 w-5 shrink-0 text-zinc-400" />
          <div className="min-w-0">
            <p className="truncate text-xs text-zinc-500">{label}</p>
            <p className="text-lg font-bold leading-tight">
              {value !== undefined ? value : "—"}
              {highlight && <Badge variant="destructive" className="ml-1.5 text-[10px]">待处理</Badge>}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}
