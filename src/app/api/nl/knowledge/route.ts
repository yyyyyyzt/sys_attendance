import { NextResponse } from "next/server"
import { apiRouteError } from "@/lib/api-route-error"
import { readKnowledge, writeKnowledge } from "@/lib/nl/knowledge"

export async function GET() {
  try {
    const knowledge = readKnowledge()
    return NextResponse.json(knowledge)
  } catch (err) {
    const message = err instanceof Error ? err.message : "读取知识库失败"
    return apiRouteError("GET /api/nl/knowledge", err, message, 500)
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const updated = writeKnowledge(body)
    return NextResponse.json(updated)
  } catch (err) {
    const message = err instanceof Error ? err.message : "保存知识库失败"
    return apiRouteError("PUT /api/nl/knowledge", err, message, 500)
  }
}
