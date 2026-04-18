"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet"
import {
  Users, Building2, Clock, CalendarDays, FileSpreadsheet,
  ClipboardList, BarChart3, Menu, Sparkles, Settings, Wallet,
} from "lucide-react"
import { GlobalCommandBar } from "@/components/nl/GlobalCommandBar"

const navItems = [
  { href: "/", label: "工作台", icon: CalendarDays },
  { href: "/teams", label: "班组管理", icon: Building2 },
  { href: "/employees", label: "员工管理", icon: Users },
  { href: "/shifts", label: "班次配置", icon: Clock },
  { href: "/schedule", label: "排班表", icon: CalendarDays },
  { href: "/import-export", label: "导入导出", icon: FileSpreadsheet },
  { href: "/leaves", label: "请假管理", icon: ClipboardList },
  { href: "/leave-quotas", label: "假期额度", icon: Wallet },
  { href: "/attendance", label: "出勤统计", icon: BarChart3 },
  { href: "/settings", label: "AI 设置", icon: Settings },
]

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <>
      {navItems.map((item) => {
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

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <div className="flex h-full min-h-screen">
      {/* PC 侧栏 */}
      <aside className="hidden w-56 shrink-0 flex-col border-r bg-zinc-50 md:flex">
        <div className="flex h-14 items-center border-b px-4">
          <h1 className="text-base font-semibold">排班考勤助手</h1>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-2">
          <NavLinks pathname={pathname} />
        </nav>
        <div className="border-t p-3">
          <Link href="/import-export">
            <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              快速导入导出
            </Button>
          </Link>
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
                <NavLinks pathname={pathname} onNavigate={() => setSheetOpen(false)} />
              </nav>
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
