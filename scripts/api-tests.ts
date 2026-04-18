/**
 * 基于 API 接口的真实业务流测试脚本。
 *
 * 场景来源：班长查看本组情况、提交请假；总经理审批 → 数据库检查。
 *
 * 约束：
 * - 不经过浏览器 / 不依赖前端。
 * - 自然语言场景 → 直接发 HTTP 请求 → 改数据库到期望状态。
 * - 断言由"直连 MySQL 查询"完成，而非读 API 返回（独立校验源，避免循环校验）。
 *
 * 前置：
 * 1. 已运行 `npm run dev`，BASE_URL 默认 http://localhost:3000（可通过 BASE_URL 覆盖）。
 * 2. 已执行过 `npm run db:sql`（含 schema）且导入过基础数据（可选 example1.csv）。
 * 3. `.env` 有合法的 `DATABASE_URL` 与 `AUTH_SECRET`。
 *
 * 用法：
 *   npx tsx --require dotenv/config scripts/api-tests.ts
 */
import "dotenv/config"
import { randomUUID, randomBytes } from "crypto"
import mysql from "mysql2/promise"

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000"

function stripMysqlUrl(url: string): string {
  const q = url.indexOf("?")
  return q === -1 ? url : url.slice(0, q)
}

async function getDb(): Promise<mysql.Connection> {
  const uri = process.env.DATABASE_URL
  if (!uri) throw new Error("DATABASE_URL 未配置")
  return mysql.createConnection({ uri: stripMysqlUrl(uri), multipleStatements: false })
}

function magicToken(): string {
  return randomBytes(32).toString("base64url")
}

/** 用 magicToken 换 cookie：请求 /api/auth/exchange，捕获 set-cookie 头 */
async function exchangeSession(token: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/exchange?t=${encodeURIComponent(token)}&next=/`, {
    redirect: "manual",
  })
  if (res.status !== 307 && res.status !== 302) {
    throw new Error(`exchange 返回 ${res.status}，期望 302/307`)
  }
  const setCookie = res.headers.get("set-cookie")
  if (!setCookie) throw new Error("exchange 未设置 cookie")
  const m = setCookie.match(/kq_session=([^;]+)/)
  if (!m) throw new Error("cookie 未包含 kq_session")
  return `kq_session=${m[1]}`
}

/** 带 cookie 调用 API */
async function api(path: string, init: RequestInit & { cookie?: string } = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  if (init.cookie) headers.set("cookie", init.cookie)
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json")
  return fetch(`${BASE_URL}${path}`, { ...init, headers })
}

async function apiJson<T = unknown>(
  path: string,
  init: RequestInit & { cookie?: string } = {},
): Promise<{ status: number; body: T }> {
  const res = await api(path, init)
  const text = await res.text()
  const body = text ? JSON.parse(text) : null
  return { status: res.status, body: body as T }
}

// ───────────────────────────── 断言工具 ─────────────────────────────

interface Counters {
  passed: number
  failed: number
  errors: string[]
}

function assertEq(c: Counters, name: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`  ✓ ${name}`)
    c.passed++
  } else {
    console.log(`  ✗ ${name}  actual=${JSON.stringify(actual)}  expected=${JSON.stringify(expected)}`)
    c.failed++
    c.errors.push(name)
  }
}
function assertTrue(c: Counters, name: string, cond: boolean, extra?: string) {
  if (cond) {
    console.log(`  ✓ ${name}`)
    c.passed++
  } else {
    console.log(`  ✗ ${name}${extra ? ` (${extra})` : ""}`)
    c.failed++
    c.errors.push(name)
  }
}

// ───────────────────────────── Fixtures ─────────────────────────────

interface Fixtures {
  departmentId: string
  teamAId: string
  teamBId: string
  teamAName: string
  teamBName: string
  shiftId: string
  shiftCode: string
  empA1: { id: string; name: string }
  empA2: { id: string; name: string }
  empB1: { id: string; name: string }
  admin: { id: string; token: string }
  manager: { id: string; token: string }
  leaderA: { id: string; token: string }
  leaderB: { id: string; token: string }
}

async function seedFixtures(db: mysql.Connection): Promise<Fixtures> {
  const ts = Date.now()
  const departmentId = randomUUID()
  const teamAId = randomUUID()
  const teamBId = randomUUID()
  const shiftId = randomUUID()
  const empA1Id = randomUUID()
  const empA2Id = randomUUID()
  const empB1Id = randomUUID()
  const adminId = randomUUID()
  const managerId = randomUUID()
  const leaderAId = randomUUID()
  const leaderBId = randomUUID()
  const adminToken = magicToken()
  const managerToken = magicToken()
  const leaderAToken = magicToken()
  const leaderBToken = magicToken()

  const teamAName = `测试A班-${ts}`
  const teamBName = `测试B班-${ts}`
  const shiftCode = `TEST${ts % 10000}`
  const empA1Name = `测A-张三-${ts}`
  const empA2Name = `测A-李四-${ts}`
  const empB1Name = `测B-王五-${ts}`

  await db.execute(
    "INSERT INTO `Department` (`id`,`name`,`createdAt`) VALUES (?,?,NOW(3))",
    [departmentId, `测试部门-${ts}`],
  )
  await db.execute(
    "INSERT INTO `Team` (`id`,`name`,`departmentId`,`leaveThreshold`,`createdAt`) VALUES (?,?,?,3,NOW(3))",
    [teamAId, teamAName, departmentId],
  )
  await db.execute(
    "INSERT INTO `Team` (`id`,`name`,`departmentId`,`leaveThreshold`,`createdAt`) VALUES (?,?,?,3,NOW(3))",
    [teamBId, teamBName, departmentId],
  )
  await db.execute(
    `INSERT INTO \`Shift\` (\`id\`,\`code\`,\`name\`,\`startTime\`,\`endTime\`,\`isCrossNight\`,\`requiredCount\`,\`workMinutes\`,\`segmentsJson\`,\`remark\`,\`createdAt\`)
     VALUES (?,?,?,?,?,?,?,?,CAST(? AS JSON),?,NOW(3))`,
    [shiftId, shiftCode, "测试班", "08:30", "18:30", 0, 1, 480, JSON.stringify([{ start: "08:30", end: "18:30" }]), "测试"],
  )
  for (const [id, name, teamId] of [
    [empA1Id, empA1Name, teamAId],
    [empA2Id, empA2Name, teamAId],
    [empB1Id, empB1Name, teamBId],
  ] as const) {
    await db.execute(
      `INSERT INTO \`Employee\` (\`id\`,\`name\`,\`teamId\`,\`position\`,\`skills\`,\`status\`,\`createdAt\`,\`updatedAt\`)
       VALUES (?,?,?,'组员',CAST('[]' AS JSON),'active',NOW(3),NOW(3))`,
      [id, name, teamId],
    )
  }
  // 用户
  await db.execute(
    "INSERT INTO `AppUser` (`id`,`name`,`role`,`teamId`,`magicToken`,`disabled`,`createdAt`,`updatedAt`) VALUES (?,?,?,?,?,0,NOW(3),NOW(3))",
    [adminId, `测试管理员-${ts}`, "ADMIN", null, adminToken],
  )
  await db.execute(
    "INSERT INTO `AppUser` (`id`,`name`,`role`,`teamId`,`magicToken`,`disabled`,`createdAt`,`updatedAt`) VALUES (?,?,?,?,?,0,NOW(3),NOW(3))",
    [managerId, `测试总经理-${ts}`, "MANAGER", null, managerToken],
  )
  await db.execute(
    "INSERT INTO `AppUser` (`id`,`name`,`role`,`teamId`,`magicToken`,`disabled`,`createdAt`,`updatedAt`) VALUES (?,?,?,?,?,0,NOW(3),NOW(3))",
    [leaderAId, `测试A班长-${ts}`, "LEADER", teamAId, leaderAToken],
  )
  await db.execute(
    "INSERT INTO `AppUser` (`id`,`name`,`role`,`teamId`,`magicToken`,`disabled`,`createdAt`,`updatedAt`) VALUES (?,?,?,?,?,0,NOW(3),NOW(3))",
    [leaderBId, `测试B班长-${ts}`, "LEADER", teamBId, leaderBToken],
  )
  // 排班：明天，A 班两人各一条
  const tomorrow = isoDate(new Date(Date.now() + 24 * 3600 * 1000))
  for (const empId of [empA1Id, empA2Id]) {
    await db.execute(
      `INSERT INTO \`Schedule\` (\`id\`,\`employeeId\`,\`teamId\`,\`shiftId\`,\`shiftDate\`,\`status\`,\`createdAt\`,\`updatedAt\`)
       VALUES (?,?,?,?,?,'scheduled',NOW(3),NOW(3))`,
      [randomUUID(), empId, teamAId, shiftId, tomorrow],
    )
  }

  return {
    departmentId,
    teamAId,
    teamBId,
    teamAName,
    teamBName,
    shiftId,
    shiftCode,
    empA1: { id: empA1Id, name: empA1Name },
    empA2: { id: empA2Id, name: empA2Name },
    empB1: { id: empB1Id, name: empB1Name },
    admin: { id: adminId, token: adminToken },
    manager: { id: managerId, token: managerToken },
    leaderA: { id: leaderAId, token: leaderAToken },
    leaderB: { id: leaderBId, token: leaderBToken },
  }
}

async function cleanupFixtures(db: mysql.Connection, f: Fixtures) {
  await db.execute("DELETE FROM `LeaveRequest` WHERE `employeeId` IN (?, ?, ?)", [f.empA1.id, f.empA2.id, f.empB1.id])
  await db.execute("DELETE FROM `LeaveBalanceAccount` WHERE `employeeId` IN (?, ?, ?)", [f.empA1.id, f.empA2.id, f.empB1.id])
  await db.execute("DELETE FROM `AttendanceRecord` WHERE `employeeId` IN (?, ?, ?)", [f.empA1.id, f.empA2.id, f.empB1.id])
  await db.execute("DELETE FROM `Schedule` WHERE `employeeId` IN (?, ?, ?)", [f.empA1.id, f.empA2.id, f.empB1.id])
  await db.execute("DELETE FROM `Employee` WHERE `id` IN (?, ?, ?)", [f.empA1.id, f.empA2.id, f.empB1.id])
  await db.execute("DELETE FROM `Team` WHERE `id` IN (?, ?)", [f.teamAId, f.teamBId])
  await db.execute("DELETE FROM `Department` WHERE `id` = ?", [f.departmentId])
  await db.execute("DELETE FROM `Shift` WHERE `id` = ?", [f.shiftId])
  await db.execute(
    "DELETE FROM `AppUser` WHERE `id` IN (?, ?, ?, ?)",
    [f.admin.id, f.manager.id, f.leaderA.id, f.leaderB.id],
  )
}

function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${dd}`
}

// ───────────────────────────── 测试用例 ─────────────────────────────

interface TestCtx {
  db: mysql.Connection
  f: Fixtures
  sessions: {
    admin: string
    manager: string
    leaderA: string
    leaderB: string
  }
  counters: Counters
}

/**
 * 用例 1：未登录时访问受保护 API 应被拒。
 *
 * 自然语言：未登录用户直接访问 `/api/employees`，接口应返回 401。
 */
async function case1UnauthReject(ctx: TestCtx) {
  console.log("\n【用例 1】未登录访问受保护 API → 401")
  const res = await api("/api/employees")
  assertEq(ctx.counters, "GET /api/employees 未带 cookie 应 401", res.status, 401)
}

/**
 * 用例 2：A 班班长用自己的链接换 cookie，能看到 /api/auth/me 里是自己。
 *
 * 自然语言：A 班班长点开管理员发的链接 → 系统记住他是 A 班长。
 */
async function case2LoginByMagicLink(ctx: TestCtx) {
  console.log("\n【用例 2】Magic link 换 session，/api/auth/me 返回正确身份")
  const me = await apiJson<{ user: { id: string; role: string; teamId: string | null } | null }>(
    "/api/auth/me",
    { cookie: ctx.sessions.leaderA },
  )
  assertEq(ctx.counters, "status 200", me.status, 200)
  assertTrue(ctx.counters, "me.user.id 等于 A 班长 id", me.body.user?.id === ctx.f.leaderA.id)
  assertEq(ctx.counters, "me.user.role === LEADER", me.body.user?.role, "LEADER")
  assertEq(ctx.counters, "me.user.teamId === A 班 id", me.body.user?.teamId, ctx.f.teamAId)
}

/**
 * 用例 3：班长查看本班组请假列表（仅本组）。
 *
 * 自然语言：A 班班长查"最近请假"，应只看到本组员工的请假，看不到 B 班。
 *   - 步骤：预置两条请假（A 组 1 条，B 组 1 条），然后以 A 班长身份调 GET /api/leaves
 *   - 期望：只返回 A 组那条
 */
async function case3LeaderListOnlyOwnTeam(ctx: TestCtx) {
  console.log("\n【用例 3】班长查看请假列表：只看得到本组")
  const today = isoDate(new Date())
  const aLeaveId = randomUUID()
  const bLeaveId = randomUUID()
  await ctx.db.execute(
    `INSERT INTO \`LeaveRequest\` (\`id\`,\`employeeId\`,\`leaveType\`,\`startDate\`,\`endDate\`,\`hours\`,\`shiftIds\`,\`reason\`,\`status\`,\`createdAt\`,\`updatedAt\`)
     VALUES (?,?,'PERSONAL',?,?,8,CAST('[]' AS JSON),'A组预置','pending',NOW(3),NOW(3))`,
    [aLeaveId, ctx.f.empA1.id, today, today],
  )
  await ctx.db.execute(
    `INSERT INTO \`LeaveRequest\` (\`id\`,\`employeeId\`,\`leaveType\`,\`startDate\`,\`endDate\`,\`hours\`,\`shiftIds\`,\`reason\`,\`status\`,\`createdAt\`,\`updatedAt\`)
     VALUES (?,?,'PERSONAL',?,?,8,CAST('[]' AS JSON),'B组预置','pending',NOW(3),NOW(3))`,
    [bLeaveId, ctx.f.empB1.id, today, today],
  )

  const r = await apiJson<Array<{ id: string; employeeId: string }>>("/api/leaves", {
    cookie: ctx.sessions.leaderA,
  })
  assertEq(ctx.counters, "status 200", r.status, 200)
  const ids = (r.body ?? []).map((x) => x.id)
  assertTrue(ctx.counters, "返回包含 A 组那条", ids.includes(aLeaveId))
  assertTrue(ctx.counters, "不包含 B 组那条", !ids.includes(bLeaveId))
}

/**
 * 用例 4：班长查本组某日请假概览（day-overview）。
 *
 * 自然语言：A 班长问"明天本组有人请假吗"，系统返回请假列表 + 风险评估。
 */
async function case4DayOverview(ctx: TestCtx) {
  console.log("\n【用例 4】班长查本组某日请假概览")
  const tomorrow = isoDate(new Date(Date.now() + 24 * 3600 * 1000))
  // 预置一条 A 组明天的 approved 请假
  const leaveId = randomUUID()
  await ctx.db.execute(
    `INSERT INTO \`LeaveRequest\` (\`id\`,\`employeeId\`,\`leaveType\`,\`startDate\`,\`endDate\`,\`hours\`,\`shiftIds\`,\`reason\`,\`status\`,\`approverId\`,\`createdAt\`,\`updatedAt\`)
     VALUES (?,?,'PERSONAL',?,?,8,CAST('[]' AS JSON),'预置已批','approved','system',NOW(3),NOW(3))`,
    [leaveId, ctx.f.empA1.id, tomorrow, tomorrow],
  )

  const r = await apiJson<{
    team: { id: string; name: string }
    onLeave: Array<{ id: string; employeeName: string }>
    stillOnDuty: Array<{ employeeId: string }>
    risk: string
  }>(`/api/leaves/day-overview?teamId=${ctx.f.teamAId}&date=${tomorrow}`, {
    cookie: ctx.sessions.leaderA,
  })
  assertEq(ctx.counters, "status 200", r.status, 200)
  assertEq(ctx.counters, "team.id", r.body.team.id, ctx.f.teamAId)
  assertTrue(
    ctx.counters,
    "onLeave 包含 empA1",
    r.body.onLeave.some((x) => x.id === leaveId),
  )
}

/**
 * 用例 5：A 班长给本组员工提交请假 → 201 + DB 有 pending 行。
 *
 * 自然语言：A 班长为"张三"提交后天请事假，应创建 pending 工单。
 */
async function case5LeaderCreateLeave(ctx: TestCtx): Promise<string> {
  console.log("\n【用例 5】班长给本组员工提交请假")
  const afterTomorrow = isoDate(new Date(Date.now() + 2 * 24 * 3600 * 1000))
  const r = await apiJson<{ id: string; status: string }>("/api/leaves", {
    method: "POST",
    cookie: ctx.sessions.leaderA,
    body: JSON.stringify({
      employeeId: ctx.f.empA1.id,
      leaveType: "PERSONAL",
      startDate: afterTomorrow,
      endDate: afterTomorrow,
      hours: 8,
      reason: "家里有事",
      shiftIds: [],
    }),
  })
  assertEq(ctx.counters, "HTTP 201", r.status, 201)
  assertTrue(ctx.counters, "返回体带 id", !!r.body?.id)

  const [rows] = await ctx.db.execute<mysql.RowDataPacket[]>(
    "SELECT `id`, `status` FROM `LeaveRequest` WHERE `id` = ?",
    [r.body.id],
  )
  assertEq(ctx.counters, "DB 里能查到这条", rows.length, 1)
  assertEq(ctx.counters, "DB 状态是 pending", rows[0]?.status, "pending")
  return r.body.id
}

/**
 * 用例 6：A 班长不能给 B 班员工提交请假 → 403。
 *
 * 自然语言：A 班长尝试给 B 班的王五提交请假，系统应拒绝。
 */
async function case6LeaderCannotCrossTeam(ctx: TestCtx) {
  console.log("\n【用例 6】班长跨班组提交请假 → 403")
  const afterTomorrow = isoDate(new Date(Date.now() + 2 * 24 * 3600 * 1000))
  const r = await api("/api/leaves", {
    method: "POST",
    cookie: ctx.sessions.leaderA,
    body: JSON.stringify({
      employeeId: ctx.f.empB1.id,
      leaveType: "PERSONAL",
      startDate: afterTomorrow,
      endDate: afterTomorrow,
      hours: 8,
      reason: "",
      shiftIds: [],
    }),
  })
  assertEq(ctx.counters, "HTTP 403 或 400", true, r.status === 403 || r.status === 400)
}

/**
 * 用例 7：班长不能审批请假 → 403。
 *
 * 自然语言：A 班长试图直接批准一条请假，应被拒。
 */
async function case7LeaderCannotApprove(ctx: TestCtx, leaveId: string) {
  console.log("\n【用例 7】班长审批请假 → 403")
  const r = await api(`/api/leaves/${leaveId}`, {
    method: "PATCH",
    cookie: ctx.sessions.leaderA,
    body: JSON.stringify({ status: "approved" }),
  })
  assertEq(ctx.counters, "HTTP 403", r.status, 403)
  const [rows] = await ctx.db.execute<mysql.RowDataPacket[]>(
    "SELECT `status` FROM `LeaveRequest` WHERE `id` = ?",
    [leaveId],
  )
  assertEq(ctx.counters, "DB 状态仍然是 pending", rows[0]?.status, "pending")
}

/**
 * 用例 8：总经理审批批准 → DB 状态变 approved + 对应日期 Schedule 变 leave。
 *
 * 自然语言：总经理批准 A 班张三那条请假。
 */
async function case8ManagerApprove(ctx: TestCtx, leaveId: string) {
  console.log("\n【用例 8】总经理审批通过 → Schedule 同步变 leave")
  // 先插一条张三那天的排班（覆盖日期 = 请假日期）
  const [rowsBefore] = await ctx.db.execute<mysql.RowDataPacket[]>(
    "SELECT `startDate`,`endDate`,`employeeId` FROM `LeaveRequest` WHERE `id` = ?",
    [leaveId],
  )
  const startDate = rowsBefore[0].startDate as string
  const empId = rowsBefore[0].employeeId as string
  // 补一条排班
  const schId = randomUUID()
  await ctx.db.execute(
    `INSERT INTO \`Schedule\` (\`id\`,\`employeeId\`,\`teamId\`,\`shiftId\`,\`shiftDate\`,\`status\`,\`createdAt\`,\`updatedAt\`)
     VALUES (?,?,?,?,?,'scheduled',NOW(3),NOW(3))`,
    [schId, empId, ctx.f.teamAId, ctx.f.shiftId, startDate],
  )

  const r = await api(`/api/leaves/${leaveId}`, {
    method: "PATCH",
    cookie: ctx.sessions.manager,
    body: JSON.stringify({ status: "approved" }),
  })
  assertEq(ctx.counters, "HTTP 200", r.status, 200)
  const [leaveRows] = await ctx.db.execute<mysql.RowDataPacket[]>(
    "SELECT `status`, `approverId` FROM `LeaveRequest` WHERE `id` = ?",
    [leaveId],
  )
  assertEq(ctx.counters, "LeaveRequest.status approved", leaveRows[0]?.status, "approved")
  assertEq(ctx.counters, "approverId === 总经理 id", leaveRows[0]?.approverId, ctx.f.manager.id)
  const [schRows] = await ctx.db.execute<mysql.RowDataPacket[]>(
    "SELECT `status` FROM `Schedule` WHERE `id` = ?",
    [schId],
  )
  assertEq(ctx.counters, "Schedule.status 变 leave", schRows[0]?.status, "leave")
}

/**
 * 用例 9：消耗型请假在无余额时创建失败。
 *
 * 自然语言：A 班长给张三提年假，但账户余额为 0，应被拒；数据库不产生 LeaveRequest。
 */
async function case9ConsumptiveNoBalance(ctx: TestCtx) {
  console.log("\n【用例 9】消耗型假期余额不足 → 400，不落库")
  // 确保无余额
  await ctx.db.execute(
    "DELETE FROM `LeaveBalanceAccount` WHERE `employeeId` = ? AND `leaveType` = 'ANNUAL'",
    [ctx.f.empA2.id],
  )
  const afterTomorrow = isoDate(new Date(Date.now() + 2 * 24 * 3600 * 1000))
  const [before] = await ctx.db.execute<mysql.RowDataPacket[]>(
    "SELECT COUNT(*) AS c FROM `LeaveRequest` WHERE `employeeId` = ? AND `leaveType` = 'ANNUAL'",
    [ctx.f.empA2.id],
  )
  const res = await api("/api/leaves", {
    method: "POST",
    cookie: ctx.sessions.leaderA,
    body: JSON.stringify({
      employeeId: ctx.f.empA2.id,
      leaveType: "ANNUAL",
      startDate: afterTomorrow,
      endDate: afterTomorrow,
      hours: 8,
      reason: "测试余额不足",
      shiftIds: [],
    }),
  })
  assertTrue(ctx.counters, "HTTP 4xx（应拒绝）", res.status >= 400 && res.status < 500)
  const [after] = await ctx.db.execute<mysql.RowDataPacket[]>(
    "SELECT COUNT(*) AS c FROM `LeaveRequest` WHERE `employeeId` = ? AND `leaveType` = 'ANNUAL'",
    [ctx.f.empA2.id],
  )
  assertEq(ctx.counters, "请假数量不增加", after[0].c, before[0].c)
}

/**
 * 用例 10：消耗型请假余额足够时批准 → 余额被正确扣减。
 *
 * 自然语言：管理员给李四开 40h 年假，班长提 8h 年假，总经理批 → 余额应剩 32h。
 */
async function case10ConsumptiveDeduction(ctx: TestCtx) {
  console.log("\n【用例 10】消耗型假期批准后余额扣减")
  const year = new Date().getFullYear()
  const afterTomorrow = isoDate(new Date(Date.now() + 2 * 24 * 3600 * 1000))

  // 管理员开户（通过 API，而非直连 DB，才能顺便测 API 权限）
  const open = await api(`/api/employees/${ctx.f.empA2.id}/leave-balances`, {
    method: "PUT",
    cookie: ctx.sessions.admin,
    body: JSON.stringify({
      year,
      items: [{ leaveType: "ANNUAL", totalHours: 40, remainingHours: 40 }],
    }),
  })
  assertEq(ctx.counters, "开户 200", open.status, 200)

  // 班长提请假
  const create = await apiJson<{ id: string }>("/api/leaves", {
    method: "POST",
    cookie: ctx.sessions.leaderA,
    body: JSON.stringify({
      employeeId: ctx.f.empA2.id,
      leaveType: "ANNUAL",
      startDate: afterTomorrow,
      endDate: afterTomorrow,
      hours: 8,
      reason: "李四年假",
      shiftIds: [],
    }),
  })
  assertEq(ctx.counters, "创建 201", create.status, 201)

  // 总经理批
  const approve = await api(`/api/leaves/${create.body.id}`, {
    method: "PATCH",
    cookie: ctx.sessions.manager,
    body: JSON.stringify({ status: "approved" }),
  })
  assertEq(ctx.counters, "审批 200", approve.status, 200)

  // 查余额
  const [rows] = await ctx.db.execute<mysql.RowDataPacket[]>(
    "SELECT `remainingHours` FROM `LeaveBalanceAccount` WHERE `employeeId` = ? AND `year` = ? AND `leaveType` = 'ANNUAL'",
    [ctx.f.empA2.id, year],
  )
  const remain = Number(rows[0]?.remainingHours ?? -1)
  assertEq(ctx.counters, "剩余年假 = 32h", remain, 32)
}

// ───────────────────────────── main ─────────────────────────────

async function main() {
  const db = await getDb()
  const f = await seedFixtures(db)
  const counters: Counters = { passed: 0, failed: 0, errors: [] }

  try {
    const sessions = {
      admin: await exchangeSession(f.admin.token),
      manager: await exchangeSession(f.manager.token),
      leaderA: await exchangeSession(f.leaderA.token),
      leaderB: await exchangeSession(f.leaderB.token),
    }
    const ctx: TestCtx = { db, f, sessions, counters }

    await case1UnauthReject(ctx)
    await case2LoginByMagicLink(ctx)
    await case3LeaderListOnlyOwnTeam(ctx)
    await case4DayOverview(ctx)
    const leaveId = await case5LeaderCreateLeave(ctx)
    await case6LeaderCannotCrossTeam(ctx)
    await case7LeaderCannotApprove(ctx, leaveId)
    await case8ManagerApprove(ctx, leaveId)
    await case9ConsumptiveNoBalance(ctx)
    await case10ConsumptiveDeduction(ctx)
  } finally {
    await cleanupFixtures(db, f)
    await db.end()
  }

  console.log(`\n==== 用例执行完毕：${counters.passed} passed, ${counters.failed} failed ====`)
  if (counters.failed > 0) {
    console.log("失败项：")
    for (const e of counters.errors) console.log(" - " + e)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error("测试脚本异常：", e)
  process.exit(1)
})
