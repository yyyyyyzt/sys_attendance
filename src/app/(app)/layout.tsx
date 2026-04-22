"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet"
import { useEffect } from "react"
import {
  Users, Building2, Clock, CalendarDays, FileSpreadsheet,
  ClipboardList, BarChart3, Menu, Sparkles, Settings, Wallet, Shield, LogOut,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { GlobalCommandBar } from "@/components/nl/GlobalCommandBar"

type Role = "LEADER" | "MANAGER" | "ADMIN"

const allNavItems: { href: string; label: string; icon: typeof Users; roles: Role[] }[] = [
  { href: "/", label: "工作台", icon: CalendarDays, roles: ["LEADER", "MANAGER", "ADMIN"] },
  { href: "/teams", label: "班组管理", icon: Building2, roles: ["ADMIN"] },
  { href: "/employees", label: "员工管理", icon: Users, roles: ["LEADER", "MANAGER", "ADMIN"] },
  { href: "/shifts", label: "班次配置", icon: Clock, roles: ["MANAGER", "ADMIN"] },
  { href: "/schedule", label: "排班表", icon: CalendarDays, roles: ["LEADER", "MANAGER", "ADMIN"] },
  { href: "/import-export", label: "导入导出", icon: FileSpreadsheet, roles: ["MANAGER", "ADMIN"] },
  { href: "/leaves", label: "请假管理", icon: ClipboardList, roles: ["LEADER", "MANAGER", "ADMIN"] },
  { href: "/leave-quotas", label: "假期额度", icon: Wallet, roles: ["ADMIN"] },
  { href: "/attendance", label: "出勤统计", icon: BarChart3, roles: ["LEADER", "MANAGER", "ADMIN"] },
  { href: "/admin/users", label: "用户管理", icon: Shield, roles: ["ADMIN"] },
  { href: "/settings", label: "AI 设置", icon: Settings, roles: ["MANAGER", "ADMIN"] },
]

function NavLinks({
  pathname,
  role,
  onNavigate,
}: {
  pathname: string
  role: Role | null
  onNavigate?: () => void
}) {
  const items = role
    ? allNavItems.filter((it) => it.roles.includes(role))
    : []
  return (
    <>
      {items.map((item) => {
        const Icon = item.icon
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-zinc-200 font-medium text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        )
      })}
    </>
  )
}

interface Me {
  id: string
  name: string
  role: Role
  teamId: string | null
  teamName: string | null
}

const ROLE_LABEL: Record<Role, string> = {
  LEADER: "班长",
  MANAGER: "总经理",
  ADMIN: "管理员",
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [me, setMe] = useState<Me | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setMe(d.user ?? null) })
      .catch(() => { if (!cancelled) setMe(null) })
    return () => { cancelled = true }
  }, [pathname])

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
  }

  return (
    <div className="flex h-full min-h-screen">
      {/* PC 侧栏 */}
      <aside className="hidden w-56 shrink-0 flex-col border-r bg-zinc-50 md:flex">
        <div className="flex h-14 items-center border-b px-4">
          <h1 className="text-base font-semibold">排班考勤助手</h1>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-2">
          <NavLinks pathname={pathname} role={me?.role ?? null} />
        </nav>
        <div className="border-t p-3 text-xs">
          {me ? (
            <div className="mb-2 flex items-center justify-between rounded bg-white p-2 shadow-sm">
              <div className="min-w-0">
                <div className="truncate font-medium text-zinc-800">{me.name}</div>
                <div className="truncate text-[11px] text-zinc-500">
                  {ROLE_LABEL[me.role]}{me.teamName ? ` · ${me.teamName}` : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title="退出登录"
                className="ml-1 rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="mb-2 text-[11px] text-zinc-400">未登录</div>
          )}
          <div className="mt-2 flex items-center gap-1.5 px-1 text-[11px] text-zinc-400">
            <Sparkles className="h-3 w-3" />
            顶部输入框支持自然语言指令
          </div>
        </div>
      </aside>

      {/* 移动端顶栏 + Sheet 抽屉 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center gap-2 border-b bg-white px-4 md:hidden">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md hover:bg-zinc-100">
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetHeader className="border-b px-4 py-4">
                <SheetTitle className="text-base">排班考勤助手</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 p-2">
                <NavLinks pathname={pathname} role={me?.role ?? null} onNavigate={() => setSheetOpen(false)} />
              </nav>
              {me && (
                <div className="mt-auto border-t p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{me.name}</div>
                      <div className="truncate text-[11px] text-zinc-500">
                        {ROLE_LABEL[me.role]}{me.teamName ? ` · ${me.teamName}` : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="ml-1 rounded p-1 text-zinc-500 hover:bg-zinc-100"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </SheetContent>
          </Sheet>
          <h1 className="text-sm font-semibold">排班考勤助手</h1>
        </header>

        <GlobalCommandBar />

        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-6xl p-4 md:p-6">{children}</div>
        </main>
      </div>
    </div>
  )
}
