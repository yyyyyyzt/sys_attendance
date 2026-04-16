import type OpenAI from "openai"
import { openai, MODEL, isConfigured } from "./openai-client"
import { NL_TOOLS, SYSTEM_PROMPT } from "./tools"
import { executeFunction } from "./executor"
import { parseIntent } from "./parse-intent"
import { formatKnowledgeForPrompt } from "./knowledge"

export interface ChatAction {
  name: string
  args: Record<string, unknown>
  result: string
}

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
  actions?: ChatAction[]
}

/**
 * 将 NL 指令（含多轮历史）发给 LLM 并自动执行 Function Call，
 * 返回最终的助手回复 + 可选的操作列表。
 * 如果 API Key 未配置，回退到本地关键词解析。
 */
export async function chat(
  history: { role: "user" | "assistant"; content: string }[],
): Promise<ChatMessage> {
  if (!isConfigured()) {
    return fallbackChat(history)
  }

  const today = new Date().toISOString().slice(0, 10)
  const knowledgeBlock = formatKnowledgeForPrompt()
  const system = SYSTEM_PROMPT
    .replace("{{today}}", today)
    .replace("{{knowledge}}", knowledgeBlock)

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    ...history,
  ]

  const actions: ChatAction[] = []

  // Function Call 循环（最多 5 轮）
  for (let round = 0; round < 5; round++) {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages,
      tools: NL_TOOLS,
      tool_choice: "auto",
    })

    const choice = response.choices[0]
    if (!choice) break

    const msg = choice.message

    // 无 tool_calls → 最终回复
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return {
        role: "assistant",
        content: msg.content ?? "操作完成",
        actions: actions.length > 0 ? actions : undefined,
      }
    }

    // 有 tool_calls → 执行并继续
    messages.push(msg)

    for (const tc of msg.tool_calls) {
      if (tc.type !== "function") continue
      const fnName = tc.function.name
      const fnArgs = JSON.parse(tc.function.arguments || "{}") as Record<string, unknown>
      const result = await executeFunction(fnName, fnArgs as Record<string, string>)
      actions.push({ name: fnName, args: fnArgs, result })
      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: result,
      })
    }
  }

  return {
    role: "assistant",
    content: "操作完成，但回复生成超时，请查看上方执行结果。",
    actions: actions.length > 0 ? actions : undefined,
  }
}

/** API Key 未配置时的本地回退 */
function fallbackChat(
  history: { role: "user" | "assistant"; content: string }[],
): ChatMessage {
  const lastUser = [...history].reverse().find((m) => m.role === "user")
  if (!lastUser) return { role: "assistant", content: "请输入指令" }

  const intent = parseIntent(lastUser.content)

  if (intent.type === "unknown") {
    return {
      role: "assistant",
      content: `暂未识别您的意图。当前为本地模式（未配置 AI Key），支持的指令：查看排班、请假、审批请假、导出排班、查看出勤。\n\n请在 .env 文件中填入 OPENAI_API_KEY 以启用 AI 对话。`,
    }
  }

  const paramsStr = Object.entries(intent.params)
    .map(([k, v]) => `${k}: ${v}`)
    .join("，")

  let hint = ""
  switch (intent.type) {
    case "viewSchedule":
      hint = "请前往「排班表」页面查看"
      break
    case "requestLeave":
      hint = "请前往「请假管理」页面提交"
      break
    case "approveLeave":
      hint = "请前往「请假管理」页面审批"
      break
    case "exportSchedule":
      hint = "请前往「导入导出」页面下载"
      break
    case "viewAttendance":
      hint = "请前往「出勤统计」页面查看"
      break
    case "addSchedule":
      hint = "请前往「排班表」页面新建"
      break
  }

  return {
    role: "assistant",
    content: `识别意图：**${intent.label}**${paramsStr ? `（${paramsStr}）` : ""}\n\n${hint}\n\n> 提示：配置 OPENAI_API_KEY 后可直接通过对话完成操作。`,
  }
}
