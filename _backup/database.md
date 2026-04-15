model Employee {
  id        String   @id @default(uuid())
  name      String   // 员工姓名
  teamId    String   // 所属班组ID
  position  String   // 岗位
  skills    String[] // 技能标签
  status    String   // active/inactive
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  team      Team?    @relation(fields: [teamId], references: [id])
  schedules Schedule[]
  leaveRequests LeaveRequest[]
}

model Team {
  id          String   @id @default(uuid())
  name        String   // 班组名称
  description String?
  createdAt   DateTime @default(now())
  
  employees   Employee[]
  schedules   Schedule[]
}

model Shift {
  id          String   @id @default(uuid())
  name        String   // 班次名称: 早班/中班/晚班等
  startTime   String   // 开始时间 HH:mm
  endTime     String   // 结束时间 HH:mm
  isCrossDay  Boolean  @default(false) // 是否跨天
  requiredCount Int    // 该班次需要的最少人数
  teamId      String   // 适用班组
  createdAt   DateTime @default(now())
}

model Schedule {
  id          String   @id @default(uuid())
  employeeId  String   // 员工ID
  teamId      String   // 班组ID
  shiftId     String   // 班次ID
  shiftDate   String   // 日期 YYYY-MM-DD
  status      String   // scheduled/leave/cancelled/completed
  note        String?
  createdAt   DateTime @default(now())
  updatedAt DateTime @updatedAt

  employee    Employee @relation(fields: [employeeId], references: [id])
  shift       Shift    @relation(fields: [shiftId], references: [id])
}

model LeaveRequest {
  id          String   @id @default(uuid())
  employeeId  String   // 申请人
  startDate   String   // 开始日期
  endDate     String   // 结束日期
  shiftIds    String[] // 涉及的班次
  reason      String   // 请假原因
  status      String   // pending/approved/rejected
  approverId  String?  // 审批人
  createdAt   DateTime @default(now())
  updatedAt DateTime @updatedAt

  employee    Employee @relation(fields: [employeeId], references: [id])
}

model AttendanceRecord {
  id          String   @id @default(uuid())
  employeeId  String   // 员工
  date        String   // 日期
  checkIn     String?  // 签到时间
  checkOut    String?  // 签退时间
  status      String   // normal/late/early/absent
  createdAt   DateTime @default(now())
}