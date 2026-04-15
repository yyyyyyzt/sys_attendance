import { NextResponse } from "next/server"
import { employeeService } from "@/lib/services/employee"
import { updateEmployeeSchema } from "@/lib/validation/employee"

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const employee = await employeeService.getById(id)
    if (!employee) return NextResponse.json({ error: "员工不存在" }, { status: 404 })
    return NextResponse.json(employee)
  } catch {
    return NextResponse.json({ error: "获取员工失败" }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const body = await request.json()
    const parsed = updateEmployeeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join("；") },
        { status: 400 },
      )
    }
    const employee = await employeeService.update(id, parsed.data)
    return NextResponse.json(employee)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "更新员工失败"
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    await employeeService.delete(id)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "删除员工失败" }, { status: 500 })
  }
}
