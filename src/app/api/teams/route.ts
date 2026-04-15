import { NextResponse } from "next/server"
import { teamService } from "@/lib/services/team"
import { createTeamSchema } from "@/lib/validation/team"

export async function GET() {
  try {
    const teams = await teamService.list()
    return NextResponse.json(teams)
  } catch {
    return NextResponse.json({ error: "获取班组列表失败" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = createTeamSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join("；") },
        { status: 400 },
      )
    }
    const team = await teamService.create(parsed.data)
    return NextResponse.json(team, { status: 201 })
  } catch {
    return NextResponse.json({ error: "创建班组失败" }, { status: 500 })
  }
}
