import { NextResponse } from "next/server"
import { shiftService } from "@/lib/services/shift"
import { createShiftSchema } from "@/lib/validation/shift"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId") ?? undefined
    const shifts = await shiftService.list(teamId)
    return NextResponse.json(shifts)
  } catch {
    return NextResponse.json({ error: "获取班次列表失败" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = createShiftSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join("；") },
        { status: 400 },
      )
    }
    const shift = await shiftService.create(parsed.data)
    return NextResponse.json(shift, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "创建班次失败"
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
