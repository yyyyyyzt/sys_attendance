"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Sparkles } from "lucide-react"

function LoginInner() {
  const params = useSearchParams()
  const error = params.get("error")

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-zinc-500" />
            <CardTitle>排班考勤助手</CardTitle>
          </div>
          <CardDescription>
            本系统仅面向内部班长 / 总经理开放。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-relaxed">
          {error === "invalid-token" ? (
            <p className="rounded-md border border-red-200 bg-red-50 p-3 text-red-700">
              登录链接无效或已被管理员重置，请联系管理员获取新链接。
            </p>
          ) : (
            <p className="rounded-md border border-blue-200 bg-blue-50 p-3 text-blue-800">
              请从管理员发给你的专属链接打开本系统；点击一次后链接即自动换成登录态，之后直接访问首页即可。
            </p>
          )}
          <div className="text-xs text-zinc-500">
            忘了链接？联系管理员在「用户管理」里为你重置。后期会接入微信扫码无感登录。
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-zinc-400">加载中…</div>}>
      <LoginInner />
    </Suspense>
  )
}
