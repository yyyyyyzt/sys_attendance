# 本地自测指南（含初始化）

> 适用范围：班长 / 总经理两级业务流闭环、假期规则引擎、Magic Link 权限、矩阵导入导出等本轮所有改造点。
> 测试不依赖 OpenAI Key（NL 部分需要再单独配 `OPENAI_API_KEY`）。

---

## 一、本次优化完成度核对

### 1. 业务流（班长 / 总经理两级闭环）

| 需求点 | 实现位置 | 状态 |
|---|---|---|
| 员工假期面板（消耗型余额 / 上限型累计 / 历史） | `GET /api/employees/:id/leave-panel`；NL 工具 `view_leave_panel`；UI 请假页点员工名 | ✅ |
| 班组当天请假概览（含 risk = ok/tight/shortage） | `GET /api/leaves/day-overview`；NL 工具 `view_team_day_leaves` | ✅ |
| 班长提单 → pending | `POST /api/leaves`，已挂 RBAC（LEADER 仅本组） | ✅ |
| 总经理审批 / 拒批 / 自动扣余额 | `PATCH /api/leaves/:id`（仅 MANAGER/ADMIN）；NL 工具 `view_pending_leaves`、`view_team_day_attendance` | ✅ |
| 消耗型 vs 上限型两类规则 | `services/leave-policy.ts` + `repos/leave-balance.ts` | ✅ |
| 默认出勤推导（不接打卡） | `attendanceService.deriveDailyAttendance` + `monthlyStats` 空表回退 | ✅ |

### 2. UI 与数据管理

| 需求点 | 实现 | 状态 |
|---|---|---|
| 每个员工可编辑的假期额度，默认 0 | `/leave-quotas` 页 + `PUT /api/employees/:id/leave-balances` | ✅ |
| 排班表日历形式、按班组分组 | `src/app/(app)/schedule/page.tsx` 重构 | ✅ |
| 矩阵格式导入导出（与 example1.csv 同构） | `GET /api/export/schedules-matrix`、`POST /api/import/schedules-matrix`（支持 csv/xlsx） | ✅ |
| 修复 Select 受控告警、button 嵌套 hydration | leaves 页 / schedule 页 | ✅ |

### 3. 权限与测试

| 需求点 | 实现 | 状态 |
|---|---|---|
| 无账密、独特 URL 识别身份 | Magic Link + HMAC cookie：`src/lib/auth/session-core.ts`、`src/proxy.ts`、`/api/auth/exchange` | ✅ |
| 后期可迁移到微信扫码 | `AppUser.wechatOpenId` 字段预留；签 cookie 入口为 `/api/auth/exchange` 抽象 | ✅ |
| 班长权限：本组读写 + 提单，不能审批 / 跨组 | `src/lib/auth/rbac.ts` 12 条规则；`/api/leaves` 已接入 | ✅ |
| 总经理：全读 + 审批 | RBAC `MANAGER` 分支 | ✅ |
| 管理员：链接生成 / 重置 / 启停 / 删除 | `/admin/users` + `/api/auth/users[/id[/reset-token]]` | ✅ |
| 接口级自然语言测试用例 | `scripts/api-tests.ts` + `docs/api-test-cases.md`（10 条） | ✅ |

### 4. 已知盲区（待下一轮）

- `/api/employees`、`/api/schedules`、`/api/teams` 等的 RBAC 拦截尚未补齐（菜单已按角色过滤，但接口直访仍能拿到全量数据）。
- 用户管理页缺二维码渲染（目前只有"复制链接"）。
- 自动化测试目前覆盖请假主流程；CRUD 类、撤销回滚类、token 失效类用例已在 `docs/api-test-cases.md` 末尾列出，等下一轮接入。

---

## 二、首次启动初始化（一条命令搞定）

不再需要手动写 SQL 插管理员。`package.json` 已加：

```json
"init:admin": "tsx --require dotenv/config scripts/init-admin.ts",
"setup":      "npm run db:sql && npm run init:admin"
```

### 完整初始化流程

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量（编辑 .env）
#    DATABASE_URL=mysql://user:pass@127.0.0.1:3306/kaoqin
#    AUTH_SECRET=至少16字节的随机串_推荐32字节以上_例如_a7b9c3d1e5f7g9h1i3j5k7l9m1n3o5p7q9r1
#    BASE_URL=http://localhost:3000   # 可选；默认就是这个

# 3. 一键初始化（建表 + 种子数据 + 创建管理员）
npm run setup

# 或者拆开执行：
# npm run db:sql              # = schema + seed
# npm run init:admin          # 仅创建/获取管理员链接
```

`init:admin` 输出形如：

```
✓ 已创建初始管理员「初始管理员」

────────── 管理员登录链接 ──────────
http://localhost:3000/?t=fA9k...
─────────────────────────────────────

使用方式：
  1. 启动开发服务器：npm run dev
  2. 浏览器打开上面的链接 → 系统自动签发 cookie 并跳转到首页
  3. 之后直接访问 http://localhost:3000 即可（cookie 默认 180 天有效）
  4. 进入「用户管理」即可创建班长 / 总经理用户并把链接分发出去
```

### `init:admin` 的开关

| 参数 | 行为 |
|---|---|
| `npm run init:admin` | 库里没有 ADMIN 时创建一个；已有则直接打印现有链接 |
| `npm run init:admin -- --name=张总` | 自定义首个管理员姓名 |
| `npm run init:admin -- --reset` | 强制重置第一个 ADMIN 的 magicToken（旧链接立即失效） |

> 想再造一个 ADMIN？登录系统后从 `/admin/users` 页可视化新建即可。

---

## 三、本地自测路径（A → F 顺序）

### A. 启动 dev server

```bash
npm run dev
```

打开 init:admin 输出的链接 → URL 里的 `?t=` 自动换成 cookie → 自动 302 到首页 → 顶部侧栏显示"初始管理员 · 管理员"。

### B. 用户管理（ADMIN 视角）

1. 左栏 `用户管理` → 点 `新增用户`：
   - 角色 `总经理` → 提交 → 弹链接 Dialog，复制保留备用。
   - 角色 `班长` → 选 `1班` → 提交 → 复制链接备用。
2. 把班长链接粘到**另一个无痕窗口**打开 → 顶部应显示班长身份。
3. 回管理员窗口点该班长行的 `重置` → 在班长无痕窗口刷新 → 应被踢回 `/login?error=invalid-token`。

### C. 班长视角

班长无痕窗口检查左栏菜单：**只看到** `工作台 / 员工管理 / 排班表 / 请假管理 / 出勤统计`（没有"用户管理"和"假期额度"）。

- `请假管理` 列表只显示本班组成员的请假；点员工名 → 假期面板弹出（年假 0 天等，因为还没分配额度）。
- 顶部命令框（若已配 `OPENAI_API_KEY`）：
  - `明天 1 班有人请假吗？` → 命中 `view_team_day_leaves`。
  - `黄菊今年还能请几天年假？` → 命中 `view_leave_panel`。

### D. 假期额度分配（ADMIN）

进 `假期额度` → 左侧选员工 → 右表把"年假"年度总额改成 `5` 天 → 保存 → 回请假页或命令框查面板，应显示 `5 天`。

### E. 请假提单与审批

班长窗口：
- 进 `请假管理` → `提交请假` → 给本组员工提 1 天事假 → 应为"待审批"。
- 用 curl 带班长 cookie 试图为别组员工提单（`POST /api/leaves` 指定 `employeeId` 是其它班组的）→ 应返回 403。
- 试图用 PATCH 直接批准 → 应返回 403。

总经理窗口：
- 进 `请假管理` → 点 `批准` → 数据库验证：
  - `LeaveRequest.status = 'approved'`
  - 当天对应 `Schedule.status = 'leave'`
  - 消耗型假期 `LeaveBalanceAccount.remainingHours` 减少
  - `LeaveRequest.approverId` = 该总经理用户的 id（自动从 cookie 取）

### F. 排班表日历

进 `排班表`：
- 默认按班组分组，每组一张卡。
- 第一行：`周一 周二 ... 周日 / 1 2 ... 30`，周末列浅底色。
- 每行一位员工，单元格点击编辑（不再有 hydration 报错）。

### G. 导入导出

进 `导入导出`：
- `矩阵导出` → xlsx → 打开应见 `班组,姓名,岗位,YYYY/M/D,...` 表头，与 `example1.csv` 同构。
- 切到 `矩阵格式` Tab → 上传刚才导出的 xlsx 或原始 `example1.csv` → 勾"清空后导入" → 完成后展示统计（部门/班组/员工/班次/排班数）。
- `明细格式` Tab：上传含 `日期/班组/员工/班次` 的 xlsx 也能导入。

### H. 退出与失效

- 侧栏底部头像右侧的登出图标 → 跳 `/login`。
- 故意改 `.env` 的 `AUTH_SECRET` 重启 → 已登录的页面刷新 → 自动跳 `/login`（HMAC 验签失败）。

---

## 四、代码侧门禁（任何时候都能跑）

```bash
npx tsc --noEmit          # 类型检查
npm run lint              # 静态检查
npm run build             # 生产构建
```

本轮提交时已确认全绿，无任何 warning。

---

## 五、自动化集成测试（可选，按需启用）

`scripts/api-tests.ts` 已写好 10 条测试用例，含完整 fixture 创建/清理：

```bash
# 终端 1：先把 dev server 跑起来（默认 3000 端口）
npm run dev

# 终端 2：跑测试
npm run test:api
```

详见 `docs/api-test-cases.md`。涵盖：未登录拒、Magic link 登录、班长仅看本组、班长跨组拒、班长不能审批、总经理审批 → 排班同步变 leave、消耗型无余额拒、消耗型批准后余额扣减、班组当日请假概览。

如果脚本异常退出导致脏数据，可以手动清理：

```sql
DELETE FROM `AppUser`             WHERE `name` LIKE '测试%';
DELETE FROM `Team`                WHERE `name` LIKE '测试%';
DELETE FROM `Department`          WHERE `name` LIKE '测试%';
-- 其余 Schedule/LeaveRequest/Employee/Shift 都用 ON DELETE 级联或手动清理 employeeId/teamId 关联即可
```

---

## 六、再造一个干净环境的最小脚本

如果想把整个数据库清空重来：

```bash
# 1. 在 MySQL 里 DROP DATABASE 后 CREATE 同名库（utf8mb4）
# 2. 然后：
npm run setup            # 建表 + 种子 + 创建管理员
npm run db:import        # 可选，从 example1.csv + example2.csv 导入真实排班
npm run dev
```

打开 init:admin 输出的链接即可登录。
