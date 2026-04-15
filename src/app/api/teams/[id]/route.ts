import { NextResponse } from "next/server"
import { teamService } from "@/lib/services/team"
import { updateTeamSchema } from "@/lib/validation/team"

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const team = await teamService.getById(id)
    if (!team) return NextResponse.json({ error: "班组不存在" }, { status: 404 })
    return NextResponse.json(team)
  } catch {
    return NextResponse.json({ error: "获取班组失败" }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const body = await request.json()
    const parsed = updateTeamSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join("；") },
        { status: 400 },
      )
    }
    const team = await teamService.update(id, parsed.data)
    return NextResponse.json(team)
  } catch {
    return NextResponse.json({ error: "更新班组失败" }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    await teamService.delete(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "删除班组失败"
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
