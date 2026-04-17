import { NextResponse } from "next/server"
import { apiRouteError } from "@/lib/api-route-error"
import { chat } from "@/lib/nl/chat"
import { isConfigured } from "@/lib/nl/openai-client"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const messages: { role: "user" | "assistant"; content: string }[] = body.messages

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "messages 不能为空" }, { status: 400 })
    }

    const result = await chat(messages)

    return NextResponse.json({
      ...result,
      aiEnabled: isConfigured(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "NL 服务异常"
    return apiRouteError("POST /api/nl", err, message, 500)
  }
}

/** 检查 AI 是否已配置 */
export async function GET() {
  return NextResponse.json({ aiEnabled: isConfigured() })
}
