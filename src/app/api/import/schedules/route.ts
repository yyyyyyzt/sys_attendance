import { NextResponse } from "next/server"
import { parseScheduleImport } from "@/lib/scheduling/excel"
import { prisma } from "@/lib/db"
import { scheduleRepo } from "@/lib/repos/schedule"
import type { CreateScheduleInput } from "@/lib/validation/schedule"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file")
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "请上传文件" }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const { rows, errors: parseErrors } = parseScheduleImport(buffer)

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "没有可导入的有效数据", errors: parseErrors },
        { status: 400 },
      )
    }

    const teams = await prisma.team.findMany()
    const employees = await prisma.employee.findMany()
    const shifts = await prisma.shift.findMany()

    const teamMap = new Map(teams.map((t: { name: string; id: string }) => [t.name, t]))
    const empMap = new Map(employees.map((e: { teamId: string; name: string; id: string }) => [`${e.teamId}_${e.name}`, e]))
    const shiftMap = new Map(shifts.map((s: { teamId: string; name: string; id: string }) => [`${s.teamId}_${s.name}`, s]))

    const validItems: CreateScheduleInput[] = []
    const resolveErrors: string[] = []

    const validStatuses = ["scheduled", "leave", "cancelled", "completed"] as const
    type ScheduleStatus = typeof validStatuses[number]

    for (const row of rows) {
      const team = teamMap.get(row.teamName)
      if (!team) {
        resolveErrors.push(`第 ${row.rowIndex} 行班组「${row.teamName}」不存在`)
        continue
      }
      const emp = empMap.get(`${team.id}_${row.employeeName}`)
      if (!emp) {
        resolveErrors.push(`第 ${row.rowIndex} 行员工「${row.employeeName}」在班组「${row.teamName}」中不存在`)
        continue
      }
      const shift = shiftMap.get(`${team.id}_${row.shiftName}`)
      if (!shift) {
        resolveErrors.push(`第 ${row.rowIndex} 行班次「${row.shiftName}」在班组「${row.teamName}」中不存在`)
        continue
      }
      const status = (validStatuses.includes(row.status as ScheduleStatus) ? row.status : "scheduled") as ScheduleStatus
      validItems.push({
        employeeId: emp.id,
        teamId: team.id,
        shiftId: shift.id,
        shiftDate: row.shiftDate,
        status,
        note: row.note || undefined,
      })
    }

    const allErrors = [...parseErrors, ...resolveErrors]

    if (validItems.length === 0) {
      return NextResponse.json(
        { error: "没有可导入的有效数据", errors: allErrors },
        { status: 400 },
      )
    }

    const result = await scheduleRepo.createMany(validItems)

    return NextResponse.json({
      count: result.count,
      errors: allErrors.length > 0 ? allErrors : undefined,
    })
  } catch {
    return NextResponse.json({ error: "导入失败" }, { status: 500 })
  }
}
