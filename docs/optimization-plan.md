# 智能排班考勤助手 - 新一轮代码优化计划

本次优化聚焦于用真实业务流打通"班长（受理人）→ 总经理（审批人）"的两级操作闭环，并把"默认出勤"、"两类假期规则"、"自然语言聚合查询"真正落到数据与代码里。

---

## 一、业务背景（需求锚点）

主要使用者只有两个角色：**班长** 和 **总经理**。目前系统**不与打卡系统对接**，所以"出勤"不是从打卡数据推出来的，而是默认全部出勤，只有请假/调休等显式事件会改变出勤状态。

真实请假流程：

1. 客服（如：5 班张三）在微信里问班长："后天我能请假吗？"
2. 班长在系统里先做 **两项查询** 决定是否受理：
   - Q1：**张三的假期面板** — 他还能请哪些假？（年假/婚假/育儿假这类消耗型余额 + 丧假/陪产假这类上限封顶 + 今年以来已请过哪些假）
   - Q2：**班组当天的请假情况** — 当天本班组是否已经有人请假，是否还有在岗冗余。
3. 班长判断可以受理 → 在系统里下达"5 班张三后天请假"，系统生成 **待审批** 工单。
4. 总经理查看工单并做自己的综合判断，常见查询：
   - 看某日某班组的出勤情况（在岗/请假/排班分布）。
   - 看某班组整月出勤情况（缺勤高峰、请假集中度）。
5. 总经理 **批准 / 驳回**。

假期规则两类：

| 类型 | 示例 | 建模方式 |
| --- | --- | --- |
| 消耗型（有年度总额，扣一次少一次） | 年假、婚假、育儿假 | `LeaveBalanceAccount(totalHours, remainingHours)`，批准后扣减 |
| 上限型（不预发余额，但单次/年度累计不得超过上限） | 丧假 ≤ 7 天、陪产假 ≤ 10 天、护理假、病假、事假 | `LeavePolicyRule.maxDays`，提交/审批时校验 |

---

## 二、当前代码的 7 个缺口（问题定位）

代码位置以 `src/lib`、`src/app` 为主。

1. **"默认出勤"未建模。** `AttendanceRecord` 表目前没有真实数据（`example1.csv` 只是排班矩阵），`attendanceService.monthlyStats` 基于空表聚合，班组月度出勤永远是 0。
   - 影响：总经理问"5 班这个月出勤情况"时数据全空。
2. **消耗型假期余额没有任何逻辑。** 虽然 `LeaveBalanceAccount` 已建表，但全项目没有 repo/service/UI/NL 工具，`leaveService.create` 不校验余额，批准时也不扣减。
   - 影响：班长无法回答"张三还有几天年假"、总经理批假时系统不能防超发。
3. **上限型假期没做校验。** `LeavePolicyRule.maxDays` 只是装饰字段，`createLeave`/`approveLeave` 都不读它。
   - 影响：给张三批 30 天丧假系统也不报错。
4. **班长视角的聚合查询缺失。** 没有"员工假期面板"接口，也没有"某班组某日请假一览"接口。班长只能靠翻列表拼凑。
5. **两级审批的语义不清。** 现在 `LeaveRequest.status` 只有 `pending/approved/rejected/cancelled`，无法区分"班长已受理待总经理审批"与"班长还没看"。业务上现在通常简化成"所有新单默认 pending 即代表班长已受理待总审批"，但需要在文档和 UI 上显式标注，NL 回答也应当澄清。
6. **NL Tool 覆盖不够。** `src/lib/nl/tools.ts` 只有 8 个函数，缺 "查员工假期面板"、"查某班组某日请假"、"查待审批列表" 这三个班长最常用的问题。执行器 `executor.ts` 也没对应 handler。
7. **approve_leave 找待审批单时不够精确。** 现在按"该员工最新一条 pending"来找，一旦同一人有多条待审，总经理"批准张三的请假"就存在歧义。需要支持按日期或 id 定位，并在模糊时主动回问。

---

## 三、优化目标（这一轮要达成的验收标准）

- 班长可以用一句自然语言问出"张三还能请哪些假、今年请过哪些假"，系统一屏回答。
- 班长可以用一句话问出"明天 5 班谁请假了"，并看到剩余在岗人数。
- 班长提 "5 班张三后天请假" 后，系统自动生成 pending 工单，并**在余额不足或超上限时直接拒绝提交**。
- 总经理可以用自然语言看到"4 月 5 日 5 班出勤情况"（从排班默认出勤推导，扣掉已批准请假）。
- 总经理批准时系统**自动扣减消耗型余额**，并把当天排班标为 leave。
- `progress.md` 阶段 7 的子项被本轮拆成可逐项打勾的具体任务。

---

## 四、代码优化方案（按子系统拆分）

### 4.1 数据层：把"默认出勤"变成一条可查询的虚拟视图

**不新增真实打卡数据**，改为在服务层提供一个 "按日期推导每人出勤状态" 的函数：

- 新增 `src/lib/services/attendance.ts#deriveDailyAttendance(teamId?, from, to)`：
  - 基础集：当日 `Schedule` 有记录的员工（视为应出勤）。
  - 覆盖规则：
    1. 当日存在 `LeaveRequest.status = 'approved'` 覆盖 → `leave`
    2. 当日 `Schedule.status = 'leave' | 'absent' | 'late' | 'early'` 显式覆盖 → 按排班状态
    3. 其它一律 `normal`（这是"默认出勤"）
  - 返回 `{date, employeeId, employeeName, teamId, teamName, status, shiftCode}[]`。
- `attendanceService.monthlyStats` 改为：若该月 `AttendanceRecord` 为空，则回退到 `deriveDailyAttendance` 聚合。
- 等未来真有打卡对接时，`AttendanceRecord` 有数据时自动优先用真实值（兼容分支）。

### 4.2 假期规则引擎

新增 `src/lib/services/leave-policy.ts`：

```ts
export const CONSUMPTIVE_LEAVE_TYPES = ['ANNUAL', 'MARRIAGE', 'CHILD_CARE'] as const
export const CAPPED_LEAVE_TYPES = ['BEREAVEMENT', 'PATERNITY', 'NURSING', 'SICK', 'PERSONAL'] as const

export async function checkLeaveEligibility(params: {
  employeeId: string
  leaveType: LeaveType
  hours: number
  year?: number
}): Promise<{ ok: true } | { ok: false; reason: string }>
```

行为：

- 消耗型：查 `LeaveBalanceAccount`，`remainingHours` 不够 → 拒绝。账户不存在时按配置的年度默认额度（`leavePolicyRule.note` 可扩展或新增配置表）自动开户。
- 上限型：按当年 `leaveType` 已批准小时数 + 本次申请小时数 ≤ `maxDays * 8` 校验。
- 其它类型：放行。

同步改造：

- `src/lib/repos/leave-balance.ts`：新增 `find(employeeId, year, leaveType)`、`deduct(...)`、`init(...)`。
- `leaveService.create`：调 `checkLeaveEligibility`，不通过就抛出语义化错误（API 返回 400，NL 里直接展示原因）。
- `leaveService.approve`：通过时，如果是消耗型，在事务里扣减 `remainingHours`。
- `LeavePolicyRule` 表补两个消耗型默认条目：`ANNUAL maxDays=5`（占位，真实数据由账户控制）、`CHILD_CARE`；`BEREAVEMENT maxDays=7`、`PATERNITY maxDays=10`、`NURSING`、`SICK`、`PERSONAL` 可配。

### 4.3 班长视角聚合接口

新增 3 个 API（`src/app/api/...`）和相应 service 方法：

1. `GET /api/employees/:id/leave-panel?year=YYYY`
   - 返回：`{ employee, balances: [{leaveType, totalHours, remainingHours}], caps: [{leaveType, maxDays, usedDays, remainingDays}], history: [{startDate, endDate, leaveType, hours, status}] }`
2. `GET /api/leaves/day-overview?teamId=...&date=YYYY-MM-DD`
   - 返回：`{ team, date, onLeave: [...], stillOnDuty: [...], requiredByShift: {shift -> {need, actual}}, risk: 'ok'|'tight'|'shortage' }`
3. `GET /api/leaves/pending?teamId=...`
   - 返回：`{ items: [...], count }`，供总经理/班长看待审批队列。

### 4.4 NL 工具扩展

`src/lib/nl/tools.ts` 追加 4 个函数定义，`executor.ts` 实现对应 handler：

- `view_leave_panel(employeeName, year?)` → 调 4.3-① 接口
- `view_team_day_leaves(teamName, date)` → 调 4.3-② 接口
- `view_pending_leaves(teamName?)` → 调 4.3-③ 接口
- `view_team_day_attendance(teamName, date)` → 基于 4.1 `deriveDailyAttendance` 的单日视图

`executor.ts` 里的 `execApproveLeave` 改造：支持可选 `startDate` 参数精确定位，多条 pending 时返回 `needClarify` 错误由 LLM 追问用户。

更新 `SYSTEM_PROMPT`：

- 明确两个角色（班长/总经理）与默认出勤规则。
- 新增"信息不全时必须先追问 startDate 再审批"的硬约束。
- 在 `knowledge.ts` 的默认 `rules` 里写入假期两分类说明，保证本地回退也能理解。

### 4.5 审批语义澄清

- `LeaveRequest.status` 保持现状，在 UI 文案、NL 回复里显式说明："pending 即班长已受理，待总经理审批"。
- `approve_leave` 的 `approverId` 默认值从 `nl-system` 改为 `manager`（可由前端传入真实 id）。
- 在 `src/components/nl/GlobalCommandBar.tsx` 或新建一个"待审批徽标"组件里，从 4.3-③ 实时读取 pending 数量供总经理点开。

### 4.6 防御性与质量

- 所有新 API 走 `apiRouteError` 统一错误处理。
- 新写 zod schema：`src/lib/validation/leave-panel.ts`、`leave-day.ts`。
- 不新增 any，`executor.ts` 为新增 handler 单独收敛参数类型。
- 每项改动后跑 `npx tsc --noEmit`、`npm run lint`、`npm run build`。

---

## 五、实施步骤（建议顺序，便于分 commit 审阅）

1. `feat(attendance): deriveDailyAttendance 默认出勤推导 + monthlyStats 回退`
2. `feat(leave): leave-balance repo/service + checkLeaveEligibility`
3. `feat(leave): create/approve 接入额度校验与自动扣减`
4. `feat(api): /employees/:id/leave-panel、/leaves/day-overview、/leaves/pending`
5. `feat(nl): 4 个新工具 + executor handler + system prompt 更新`
6. `feat(ui): 请假页 "员工假期面板" Drawer + 待审批徽标（可选）`
7. `docs(progress): 更新阶段 7 checkbox，补 docs/nl-test-cases.md 自测脚本`

每步完成跑一次三件套门禁；第 3、5 步需要新增/调整 `queries/nl-fixtures/*.sql`，让 SQL 对照与代码口径同步。

---

## 六、风险与兼容说明

- **余额初始化来源未定**：目前代码没有"从 HR 系统导入余额"的入口。优化里先给出 `init(employeeId, year, leaveType, totalHours)` API，页面由管理员手填；生产接入前以 "年假 40h + 婚假 80h + 育儿假 80h" 做演示默认值。
- **多人同天请假触发阈值告警**：`Team.leaveThreshold` 字段已存在，`view_team_day_leaves` 响应里应包含 "当天请假人数 ≥ 阈值" 的标记，以便 UI 飘红。
- **跨夜班**：`Shift.isCrossNight` 的夜班跨日，`deriveDailyAttendance` 按 `shiftDate` 判定（即 "起始日"），与现有排班一致。
- **撤销请假不自动恢复排班**：保持既有边界（见 `人工校验节点.txt`），但新增的扣假逻辑需要在 `cancel` 时回滚余额。

---

## 七、完成标志（Definition of Done）

- 班长用自然语言可以完成"查余额 → 查班组 → 提交请假"三步。
- 总经理用自然语言可以完成"查队列 → 查出勤 → 审批"三步。
- 所有新增接口有对应 `docs/nl-test-cases.md` 的自然语言用例并可稳定通过。
- `npx tsc --noEmit`、`npm run lint`、`npm run build` 全绿。
