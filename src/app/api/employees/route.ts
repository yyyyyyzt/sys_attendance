import { NextResponse } from "next/server"
import { apiRouteError } from "@/lib/api-route-error"
import { employeeService } from "@/lib/services/employee"
import { createEmployeeSchema } from "@/lib/validation/employee"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId") ?? undefined
    const employees = await employeeService.list(teamId)
    return NextResponse.json(employees)
  } catch (err) {
    return apiRouteError("GET /api/employees", err, "获取员工列表失败", 500)
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = createEmployeeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join("；") },
        { status: 400 },
      )
    }
    const employee = await employeeService.create(parsed.data)
    return NextResponse.json(employee, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "创建员工失败"
    return apiRouteError("POST /api/employees", err, msg, 400)
  }
}
