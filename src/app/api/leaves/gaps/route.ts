import { NextResponse } from "next/server"
import { leaveService } from "@/lib/services/leave"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    const from = searchParams.get("from")
    const to = searchParams.get("to")

    if (!teamId || !from || !to) {
      return NextResponse.json({ error: "请提供 teamId、from、to 参数" }, { status: 400 })
    }

    const gaps = await leaveService.detectGaps(teamId, from, to)
    return NextResponse.json(gaps)
  } catch {
    return NextResponse.json({ error: "缺口检测失败" }, { status: 500 })
  }
}
