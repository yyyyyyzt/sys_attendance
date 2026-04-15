import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"
import { PrismaClient } from "../src/generated/prisma/client"
import path from "path"

const dbPath = path.join(process.cwd(), "dev.db")
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` })
const prisma = new PrismaClient({ adapter })

async function main() {
  // 班组
  const teamA = await prisma.team.create({ data: { name: "客服A组", description: "白班客服团队" } })
  const teamB = await prisma.team.create({ data: { name: "客服B组", description: "夜班客服团队" } })

  // 班次
  const morning = await prisma.shift.create({
    data: { name: "早班", startTime: "08:00", endTime: "16:00", requiredCount: 3, teamId: teamA.id },
  })
  const afternoon = await prisma.shift.create({
    data: { name: "中班", startTime: "16:00", endTime: "00:00", requiredCount: 2, teamId: teamA.id },
  })
  const night = await prisma.shift.create({
    data: { name: "夜班", startTime: "00:00", endTime: "08:00", isCrossDay: true, requiredCount: 2, teamId: teamB.id },
  })

  // 员工
  const emp1 = await prisma.employee.create({
    data: { name: "张三", teamId: teamA.id, position: "高级客服", skills: JSON.stringify(["电话客服", "工单处理"]), status: "active" },
  })
  const emp2 = await prisma.employee.create({
    data: { name: "李四", teamId: teamA.id, position: "客服专员", skills: JSON.stringify(["在线客服"]), status: "active" },
  })
  const emp3 = await prisma.employee.create({
    data: { name: "王五", teamId: teamB.id, position: "夜班客服", skills: JSON.stringify(["电话客服", "投诉处理"]), status: "active" },
  })
  const emp4 = await prisma.employee.create({
    data: { name: "赵六", teamId: teamA.id, position: "客服组长", skills: JSON.stringify(["电话客服", "质检"]), status: "active" },
  })

  // 本周排班（2026-04-13 ~ 2026-04-19）
  const dates = ["2026-04-13", "2026-04-14", "2026-04-15", "2026-04-16", "2026-04-17"]
  for (const d of dates) {
    await prisma.schedule.create({ data: { employeeId: emp1.id, teamId: teamA.id, shiftId: morning.id, shiftDate: d, status: "scheduled" } })
    await prisma.schedule.create({ data: { employeeId: emp2.id, teamId: teamA.id, shiftId: afternoon.id, shiftDate: d, status: "scheduled" } })
    await prisma.schedule.create({ data: { employeeId: emp3.id, teamId: teamB.id, shiftId: night.id, shiftDate: d, status: "scheduled" } })
    await prisma.schedule.create({ data: { employeeId: emp4.id, teamId: teamA.id, shiftId: morning.id, shiftDate: d, status: "scheduled" } })
  }

  // 请假申请
  await prisma.leaveRequest.create({
    data: { employeeId: emp2.id, startDate: "2026-04-18", endDate: "2026-04-19", reason: "[事假] 家中有事需处理", status: "pending" },
  })
  await prisma.leaveRequest.create({
    data: { employeeId: emp1.id, startDate: "2026-04-21", endDate: "2026-04-21", reason: "[病假] 身体不适", status: "approved" },
  })

  // 出勤记录
  await prisma.attendanceRecord.create({
    data: { employeeId: emp1.id, date: "2026-04-14", checkIn: "07:58", checkOut: "16:05", status: "normal" },
  })
  await prisma.attendanceRecord.create({
    data: { employeeId: emp2.id, date: "2026-04-14", checkIn: "16:15", checkOut: "00:02", status: "late" },
  })
  await prisma.attendanceRecord.create({
    data: { employeeId: emp3.id, date: "2026-04-14", checkIn: "00:03", checkOut: "08:00", status: "normal" },
  })
  await prisma.attendanceRecord.create({
    data: { employeeId: emp4.id, date: "2026-04-14", checkIn: "08:32", checkOut: "16:00", status: "late" },
  })
  await prisma.attendanceRecord.create({
    data: { employeeId: emp1.id, date: "2026-04-15", checkIn: "07:55", checkOut: "16:10", status: "normal" },
  })

  console.log("✅ 种子数据已插入：")
  console.log(`   班组: ${teamA.name}, ${teamB.name}`)
  console.log(`   班次: ${morning.name}, ${afternoon.name}, ${night.name}`)
  console.log(`   员工: 张三, 李四, 王五, 赵六`)
  console.log(`   排班: ${dates.length * 4} 条`)
  console.log(`   请假: 2 条（1 待审批, 1 已批准）`)
  console.log(`   出勤: 5 条`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
