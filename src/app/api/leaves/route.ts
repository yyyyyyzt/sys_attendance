import { NextResponse } from "next/server"
import { leaveService } from "@/lib/services/leave"
import { createLeaveSchema, leaveQuerySchema } from "@/lib/validation/leave"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = leaveQuerySchema.safeParse({
      employeeId: searchParams.get("employeeId") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
    })
    if (!query.success) {
      return NextResponse.json(
        { error: query.error.issues.map((i) => i.message).join("；") },
        { status: 400 },
      )
    }
    const leaves = await leaveService.list(query.data)
    return NextResponse.json(leaves)
  } catch {
    return NextResponse.json({ error: "获取请假列表失败" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = createLeaveSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join("；") },
        { status: 400 },
      )
    }
    const leave = await leaveService.create(parsed.data)
    return NextResponse.json(leave, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "创建请假申请失败"
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
