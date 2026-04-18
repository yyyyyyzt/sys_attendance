"use client"

import { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Sparkles, Send, X, ChevronUp, ChevronDown, Loader2, Download, Bug } from "lucide-react"

interface ChatAction {
  name: string
  args?: Record<string, unknown>
  result: string
}

interface ChatMessage {
  role: "user" | "assistant"
  content: string
  actions?: ChatAction[]
}

const ACTION_LABELS: Record<string, string> = {
  view_schedule: "查看排班",
  create_leave: "请假申请",
  approve_leave: "审批请假",
  create_schedule: "新建排班",
  view_attendance: "查看出勤",
  export_schedule: "导出排班",
  view_leave_gaps: "缺口预警",
  view_attendance_alerts: "出勤异常",
  view_leave_panel: "员工假期面板",
  view_team_day_leaves: "班组当日请假",
  view_pending_leaves: "待审批队列",
  view_team_day_attendance: "班组当日出勤",
}

export function GlobalCommandBar() {
  const [expanded, setExpanded] = useState(false)
  const [query, setQuery] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null)
  const [showDebug, setShowDebug] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/nl")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setAiEnabled(d.aiEnabled === true) })
      .catch(() => { if (!cancelled) setAiEnabled(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = query.trim()
    if (!text || loading) return

    const userMsg: ChatMessage = { role: "user", content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setQuery("")
    setExpanded(true)
    setLoading(true)

    try {
      const res = await fetch("/api/nl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessages([...newMessages, { role: "assistant", content: `错误：${data.error ?? "请求失败"}` }])
      } else {
        setMessages([...newMessages, {
          role: "assistant",
          content: data.content,
          actions: data.actions,
        }])
      }
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "网络异常，请稍后重试" }])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  function clearChat() {
    setMessages([])
    setExpanded(false)
  }

  return (
    <div className="relative border-b bg-white">
      {/* 顶栏输入行 */}
      <div className="px-3 py-2 md:px-4">
        <form onSubmit={handleSubmit} className="mx-auto flex max-w-2xl items-center gap-1.5 md:gap-2">
          <Sparkles className="hidden h-4 w-4 shrink-0 text-zinc-400 sm:block" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => messages.length > 0 && setExpanded(true)}
            placeholder={aiEnabled ? "输入指令，如「给张三排明天早班」…" : "输入指令（本地模式，配置 API Key 启用 AI）…"}
            className="h-9 flex-1 border-none bg-zinc-50 text-sm shadow-none focus-visible:ring-0 md:h-8"
            disabled={loading}
          />
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
          ) : (
            <Button type="submit" size="sm" variant="ghost" className="h-8 shrink-0 px-2 text-xs md:px-3">
              <Send className="mr-1 h-3.5 w-3.5" />
              发送
            </Button>
          )}
          {messages.length > 0 && (
            <div className="flex items-center gap-0.5">
              <Button
                type="button" size="sm" variant="ghost" className="h-8 px-1.5"
                onClick={() => setShowDebug(!showDebug)}
                title={showDebug ? "隐藏调试" : "显示调试"}
              >
                <Bug className={`h-3.5 w-3.5 ${showDebug ? "text-amber-500" : "text-zinc-300"}`} />
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-8 px-1.5" onClick={() => setExpanded(!expanded)}>
                {expanded
                  ? <ChevronUp className="h-3.5 w-3.5" />
                  : <ChevronDown className="h-3.5 w-3.5" />
                }
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-8 px-1.5" onClick={clearChat}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </form>
        {aiEnabled !== null && !expanded && (
          <div className="mx-auto mt-0.5 flex max-w-2xl items-center gap-1.5">
            <Badge variant={aiEnabled ? "default" : "secondary"} className="text-[10px]">
              {aiEnabled ? "AI 模式" : "本地模式"}
            </Badge>
          </div>
        )}
      </div>

      {/* 对话面板 — 移动端全屏高度、PC 最大 60vh */}
      {expanded && messages.length > 0 && (
        <div className="border-t bg-zinc-50/80">
          <div
            ref={scrollRef}
            className="mx-auto max-h-[70vh] max-w-2xl space-y-3 overflow-y-auto p-3 md:max-h-[60vh] md:p-4"
          >
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} showDebug={showDebug} />
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                思考中…
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function MessageBubble({ message, showDebug }: { message: ChatMessage; showDebug: boolean }) {
  const isUser = message.role === "user"

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <Card className={`max-w-[90%] px-3 py-2 md:max-w-[85%] ${isUser ? "bg-zinc-900 text-white" : "bg-white"}`}>
        <div className="whitespace-pre-wrap text-sm leading-relaxed">
          {renderMarkdownLite(message.content)}
        </div>

        {/* 操作结果 + Debug 信息 */}
        {message.actions && message.actions.length > 0 && (
          <div className="mt-2 space-y-2 border-t pt-2">
            {message.actions.map((action, i) => {
              const parsed = safeParse(action.result)
              const downloadUrl = parsed?.data?.downloadUrl as string | undefined
              return (
                <div key={i} className="space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <Badge variant="outline" className="text-[10px]">
                      {ACTION_LABELS[action.name] ?? action.name}
                    </Badge>
                    {parsed?.success === true && (
                      <span className="text-green-600">✓ 成功</span>
                    )}
                    {parsed?.success === false && (
                      <span className="text-red-500">✗ {parsed.error}</span>
                    )}
                    {downloadUrl && (
                      <a
                        href={downloadUrl}
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Download className="h-3 w-3" />
                        下载
                      </a>
                    )}
                  </div>

                  {/* Debug 面板 */}
                  {showDebug && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] leading-relaxed text-amber-900">
                      <div className="mb-1 flex items-center gap-1 font-medium">
                        <Bug className="h-3 w-3" />
                        调试信息
                      </div>
                      <div>
                        <span className="text-amber-600">函数：</span>
                        <code className="rounded bg-amber-100 px-1">{action.name}</code>
                      </div>
                      {action.args && Object.keys(action.args).length > 0 && (
                        <div className="mt-0.5">
                          <span className="text-amber-600">参数：</span>
                          <code className="rounded bg-amber-100 px-1">
                            {JSON.stringify(action.args, null, 0)}
                          </code>
                        </div>
                      )}
                      {parsed?.data && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-amber-600 hover:underline">返回数据</summary>
                          <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-amber-100 p-1 text-[10px]">
                            {JSON.stringify(parsed.data, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}

function safeParse(str: string) {
  try { return JSON.parse(str) } catch { return null }
}

function renderMarkdownLite(text: string) {
  const parts = text.split(/(\*\*.*?\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    return <span key={i}>{part}</span>
  })
}
