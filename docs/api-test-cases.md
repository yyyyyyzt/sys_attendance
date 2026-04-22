# 基于接口的业务流回归：自然语言用例 ↔ 可执行测试

> 用法：确保 `npm run dev` 在 3000 端口（或设 `BASE_URL` 环境变量），本地 `.env` 含可写的 `DATABASE_URL` 与 `AUTH_SECRET`，然后运行：
>
> ```bash
> npm run test:api
> ```
>
> 脚本位置 `scripts/api-tests.ts`。每个用例都会：
> 1. 在数据库预置干净的 fixture（测试班组/员工/用户/token）；
> 2. 通过 `/api/auth/exchange?t=...` 用 magicToken 换 cookie；
> 3. 用 cookie 直接调 REST 接口；
> 4. 直连 MySQL 查询断言（**不读 API 返回做 DB 状态校验**，断言源独立）；
> 5. 结束时把所有 fixture 清理掉。
>
> 不依赖前端，不依赖浏览器，不依赖 OpenAI Key。

## 角色与 Fixtures

每次运行会动态创建如下资源（名字带时间戳避免冲突）：

| 角色 | 说明 | 在测试中用的 token / session |
| --- | --- | --- |
| 管理员 | ADMIN，不绑定班组 | `sessions.admin` |
| 总经理 | MANAGER，不绑定班组 | `sessions.manager` |
| A 班班长 | LEADER，teamId = 测试 A 班 | `sessions.leaderA` |
| B 班班长 | LEADER，teamId = 测试 B 班 | `sessions.leaderB` |
| 员工 A1（"张三"） | 测试 A 班组员 | 用于请假/排班 |
| 员工 A2（"李四"） | 测试 A 班组员 | 用于请假/排班 |
| 员工 B1（"王五"） | 测试 B 班组员 | 用于跨组隔离验证 |
| 班次 | `TEST####`，08:30-18:30 | 排班用 |

## 用例清单

### 用例 1 · 未登录访问应 401

- **自然语言**：陌生人直接打开接口 `/api/employees`，系统应当拒绝。
- **接口**：`GET /api/employees`（不带 cookie）
- **断言**：HTTP 401。

### 用例 2 · Magic link 登录后 `/api/auth/me` 返回正确身份

- **自然语言**：A 班班长点开管理员发给他的链接，此后系统永远认得他，知道他是 A 班长。
- **接口**：`GET /api/auth/exchange?t=<A班长token>&next=/` → 返回 set-cookie；`GET /api/auth/me` 带 cookie。
- **断言**：`user.id === A班长id`，`user.role === "LEADER"`，`user.teamId === A班id`。

### 用例 3 · 班长查请假列表只能看到本班组

- **自然语言**：A 班长看"最近请假"，应只看到本组员工的请假，B 班员工的请假应被过滤掉。
- **预置**：给 A 组员工和 B 组员工各插一条 pending 请假。
- **接口**：`GET /api/leaves` 带 A 班长 cookie。
- **断言**：返回数组包含 A 组那条 id，不包含 B 组那条 id。

### 用例 4 · 班长查班组当天请假概览

- **自然语言**：A 班长问"明天我们组有人请假吗？"
- **预置**：给 A 组员工插一条明天的 `approved` 请假。
- **接口**：`GET /api/leaves/day-overview?teamId=<A组id>&date=<明天>` 带 A 班长 cookie。
- **断言**：`team.id === A组id`，`onLeave` 数组中包含刚插入的记录 id。

### 用例 5 · 班长给本组员工提交请假

- **自然语言**：A 班长在群里收到张三消息"我后天请假"，他在系统里一键提交。
- **接口**：`POST /api/leaves` 带 A 班长 cookie；body 含 `employeeId=A1, leaveType=PERSONAL, startDate=后天, hours=8, reason=家里有事`。
- **断言**：HTTP 201，返回体带 `id`；直连 DB 查 `LeaveRequest`，存在且 `status = 'pending'`。

### 用例 6 · 班长不能给其它班组员工提交请假

- **自然语言**：A 班长误点到 B 班的王五头上试图请假，系统必须拒绝。
- **接口**：`POST /api/leaves` 带 A 班长 cookie，`employeeId` 是 B 班员工。
- **断言**：HTTP 403 或 400（看具体实现路径）。

### 用例 7 · 班长不能审批请假

- **自然语言**：A 班长点了"批准"按钮（或直接打接口），系统必须拒绝，让他把审批权留给总经理。
- **接口**：`PATCH /api/leaves/:id` 带 A 班长 cookie，`{status: "approved"}`。
- **断言**：HTTP 403；DB 中该记录 `status` 仍为 `pending`。

### 用例 8 · 总经理审批通过 → 排班同步变 leave

- **自然语言**：总经理看到用例 5 那条请假，综合判断后点"批准"；系统同步把当天的排班状态改成 leave。
- **预置**：给张三在请假那天插一条 `scheduled` 排班。
- **接口**：`PATCH /api/leaves/:id` 带 MANAGER cookie，`{status: "approved"}`。
- **断言**：
  - HTTP 200；
  - DB `LeaveRequest.status === 'approved'`；
  - DB `LeaveRequest.approverId` 等于总经理的 userId（即审批人由 cookie 注入，不需要前端传）；
  - DB 那条 `Schedule.status === 'leave'`。

### 用例 9 · 消耗型假期无余额时创建失败

- **自然语言**：李四的年假账户还没建/余额为 0，班长想替他提 1 天年假；系统必须拒绝且不写库。
- **预置**：删除李四 `LeaveBalanceAccount` 中的 `ANNUAL` 行。
- **接口**：`POST /api/leaves` 带 A 班长 cookie，`leaveType=ANNUAL, hours=8`。
- **断言**：HTTP 4xx；`LeaveRequest` 表中李四的 ANNUAL 计数不增加。

### 用例 10 · 消耗型假期批准后余额正确扣减（端到端）

- **自然语言**：管理员给李四开了 40h（5 天）年假 → A 班长替他提 8h → 总经理批准 → 账户还剩 32h。
- **接口**：
  1. `PUT /api/employees/:A2id/leave-balances` 带 ADMIN cookie，分配 `ANNUAL totalHours=40`；
  2. `POST /api/leaves` 带 A 班长 cookie，提 8h 年假；
  3. `PATCH /api/leaves/:id` 带 MANAGER cookie，批准。
- **断言**：DB `LeaveBalanceAccount.remainingHours === 32`。

---

## 失败时的排查顺序

1. `npm run dev` 是否在运行？默认端口 3000。若改了端口需设环境变量 `BASE_URL=http://localhost:XXXX`。
2. `.env` 中 `AUTH_SECRET` 至少 16 字节。更换 SECRET 后所有已签 cookie 立即失效。
3. 数据库字符集是 `utf8mb4_unicode_ci`；手动 MySQL 实例需先 `npm run db:sql`。
4. 用例有前后依赖（用例 5 → 7 → 8 共用同一条 `leaveId`），中间失败时后续断言会级联失败——先修最早报错那条。
5. 脚本在 `finally` 里清理 fixture；若上次异常退出残留了脏数据，可手动：
   ```sql
   DELETE FROM `AppUser` WHERE `name` LIKE '测试%';
   DELETE FROM `Team`    WHERE `name` LIKE '测试%';
   -- 其余类推
   ```

## 后续扩展建议

- 接入 `queries/nl-fixtures/*.sql` 的对照，让同一场景既有 SQL 也有 API 用例。
- 增加"班长对本组员工的 CRUD"用例（`/api/employees` 加 RBAC 拦截后直接套用。
- 增加"管理员生成/重置 magicToken"用例：`POST /api/auth/users/:id/reset-token` → 旧 token `/exchange` 应被拒。
- 接入 CI：`npm run build` + `npm run test:api`（后者需 MySQL 和 dev server，CI 上以 docker-compose 起一套）。
