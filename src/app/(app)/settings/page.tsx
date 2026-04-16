"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Save, RotateCcw, Sparkles, BookOpen, Scale, MessageSquare } from "lucide-react"
import { toast } from "sonner"

interface AIKnowledge {
  terminology: string
  rules: string
  customPrompt: string
  updatedAt: string
}

export default function SettingsPage() {
  const [knowledge, setKnowledge] = useState<AIKnowledge>({
    terminology: "", rules: "", customPrompt: "", updatedAt: "",
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch("/api/nl/knowledge")
        const data = await res.json()
        if (!cancelled) setKnowledge(data)
      } catch {
        toast.error("加载知识库失败")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch("/api/nl/knowledge", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          terminology: knowledge.terminology,
          rules: knowledge.rules,
          customPrompt: knowledge.customPrompt,
        }),
      })
      if (!res.ok) throw new Error("保存失败")
      const data = await res.json()
      setKnowledge(data)
      toast.success("知识库已保存，下次对话将使用新配置")
    } catch {
      toast.error("保存失败")
    } finally {
      setSaving(false)
    }
  }

  async function handleReset() {
    if (!confirm("确定要恢复默认知识库配置吗？当前内容将被覆盖。")) return
    setSaving(true)
    try {
      const res = await fetch("/api/nl/knowledge", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          terminology: `- 夜班 = 晚班\n- A组 = 客服A组\n- B组 = 客服B组\n- 调休 = 请假（类型：事假）`,
          rules: `- 每个班次每天至少需要满足 requiredCount 人在岗\n- 请假审批后自动将对应排班状态改为"请假"\n- 如果用户没说具体日期，默认指今天`,
          customPrompt: "",
        }),
      })
      if (!res.ok) throw new Error("重置失败")
      const data = await res.json()
      setKnowledge(data)
      toast.success("已恢复默认配置")
    } catch {
      toast.error("重置失败")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-zinc-400">加载中…</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">AI 设置</h2>
          <p className="text-sm text-zinc-500">配置 AI 助手的业务知识，让它更好地理解你的指令</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} disabled={saving}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            恢复默认
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="mr-1 h-3.5 w-3.5" />
            {saving ? "保存中…" : "保存"}
          </Button>
        </div>
      </div>

      {knowledge.updatedAt && (
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <Sparkles className="h-3 w-3" />
          上次更新：{new Date(knowledge.updatedAt).toLocaleString("zh-CN")}
        </div>
      )}

      {/* 术语对照 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-blue-500" />
            <CardTitle className="text-base">业务术语对照</CardTitle>
          </div>
          <CardDescription>
            告诉 AI 你们内部的叫法和系统中实际名称的对应关系。
            格式：每行一条，如「夜班 = 晚班」「老张 = 张三」
          </CardDescription>
        </CardHeader>
        <CardContent>
          <textarea
            value={knowledge.terminology}
            onChange={(e) => setKnowledge({ ...knowledge, terminology: e.target.value })}
            rows={6}
            className="w-full rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm leading-relaxed outline-none transition-colors focus:border-zinc-400 focus:bg-white"
            placeholder={"- 夜班 = 晚班\n- A组 = 客服A组\n- 老王 = 王五"}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="text-[10px]">示例：夜班 = 晚班</Badge>
            <Badge variant="secondary" className="text-[10px]">示例：A组 = 客服A组</Badge>
            <Badge variant="secondary" className="text-[10px]">示例：老张 = 张三</Badge>
          </div>
        </CardContent>
      </Card>

      {/* 业务规则 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-green-500" />
            <CardTitle className="text-base">业务规则</CardTitle>
          </div>
          <CardDescription>
            AI 在执行操作时需要遵守的业务约束和默认行为。
            例如：最少人数、默认日期逻辑、审批流程等。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <textarea
            value={knowledge.rules}
            onChange={(e) => setKnowledge({ ...knowledge, rules: e.target.value })}
            rows={6}
            className="w-full rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm leading-relaxed outline-none transition-colors focus:border-zinc-400 focus:bg-white"
            placeholder={"- 每个班次每天至少需要3人在岗\n- 如果用户没说日期，默认指今天\n- 请假需要说明原因"}
          />
        </CardContent>
      </Card>

      {/* 自由提示词 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-purple-500" />
            <CardTitle className="text-base">自由提示词</CardTitle>
          </div>
          <CardDescription>
            直接附加到 AI 的系统指令中，可以用来调整语气、行为偏好等。
            高级用户可以在这里写任意 prompt 内容。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <textarea
            value={knowledge.customPrompt}
            onChange={(e) => setKnowledge({ ...knowledge, customPrompt: e.target.value })}
            rows={5}
            className="w-full rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm leading-relaxed outline-none transition-colors focus:border-zinc-400 focus:bg-white"
            placeholder={"例如：回复要简洁，不要超过3句话。如果不确定用户的意思，先询问确认。"}
          />
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="flex items-start gap-3 p-4">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div className="text-sm text-amber-800">
            <p className="font-medium">提示</p>
            <p className="mt-1 leading-relaxed">
              修改保存后，下一次 AI 对话将自动使用新配置。你可以在对话中开启调试模式（🐛 按钮）查看 AI 是否正确理解了你的指令。
              如果效果不理想，可以尝试在术语对照中增加更多同义词映射，或在业务规则中补充约束条件。
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-1 h-4 w-4" />
          {saving ? "保存中…" : "保存配置"}
        </Button>
      </div>
    </div>
  )
}
