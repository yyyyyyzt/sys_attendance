import { NextResponse } from "next/server"
import { shiftService } from "@/lib/services/shift"
import { updateShiftSchema } from "@/lib/validation/shift"

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const shift = await shiftService.getById(id)
    if (!shift) return NextResponse.json({ error: "班次不存在" }, { status: 404 })
    return NextResponse.json(shift)
  } catch {
    return NextResponse.json({ error: "获取班次失败" }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const body = await request.json()
    const parsed = updateShiftSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join("；") },
        { status: 400 },
      )
    }
    const shift = await shiftService.update(id, parsed.data)
    return NextResponse.json(shift)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "更新班次失败"
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    await shiftService.delete(id)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "删除班次失败" }, { status: 500 })
  }
}
