# 权限方案设计：基于 Magic Link 的无感身份识别

> 面向 10+ 班长 + 1 总经理的小闭环内部工具。设计原则：**尽量无感**，不引入密码体系，但保留后续迁移到微信小程序 / 企业微信扫码登录的可能性。

---

## 一、需求复盘

- 使用者：≤ 20 人（班长 × N + 总经理 × 1 + 管理员 × 1）。
- 场景：班长群里把链接发给对应班长点开就进入自己的界面；总经理同理。
- 约束：不想搞账号密码、注册、找回密码等复杂流程。
- 后期可能：迁移到微信小程序；或在 Web 端直接用企业微信/微信扫码的 `openid` 替代当前的 token。
- 权限：
  - **班长**：读写**本班组**员工/排班/请假；能**新建请假**，不能**审批**请假；增删改本组员工（可后期收紧）。
  - **总经理**：所有班组只读 + 审批请假 + 所有业务数据读。
  - **管理员**：用户管理 + 假期额度分配 + 其它配置。

---

## 二、方案选型

| 方案 | 无感程度 | 安全性 | 复杂度 | 后期迁移 |
|---|---|---|---|---|
| 账号密码 | 低 | 中 | 高 | 不友好 |
| OTP 短信/邮箱 | 中 | 中 | 中 | 一般 |
| **Magic Link（独特 URL + cookie）** | **高** | **中** | **低** | **友好** |
| 微信扫码 OAuth | 高 | 高 | 中高 | 天然 |
| IP 白名单 | 高 | 低 | 低 | 差 |

**选 Magic Link**。每个用户有一个长期有效的 `magicToken`，URL 形如：

```
https://{domain}/?t=eyJ...      # 或任何页面路径带 ?t=...
```

用户第一次点击这个链接：
1. Middleware 识别到 `?t=xxx`。
2. 查 `AppUser.magicToken === xxx`，通过 → 签发 Session cookie（HttpOnly, SameSite=Lax, 180 天）。
3. 301 去掉 URL 里的 `?t=...`，避免后续泄漏。
4. 之后所有请求用 cookie 做身份识别，直到 cookie 过期。

用户丢了设备：管理员在 `/admin/users` 页"重置链接"即可生成新的 `magicToken`，旧 token 立即失效。

生成一个二维码供微信扫码打开——iPhone/Android 浏览器扫码都能直接把链接传到默认浏览器。

---

## 三、数据模型

新增一张 `AppUser` 表：

```sql
CREATE TABLE `AppUser` (
  `id`          VARCHAR(191) NOT NULL,
  `name`        VARCHAR(191) NOT NULL,              -- 显示名，如 "黄菊（1班 班长）"
  `role`        ENUM('LEADER','MANAGER','ADMIN') NOT NULL,
  `teamId`      VARCHAR(191) NULL,                  -- 班长必填，总经理/管理员可空
  `magicToken`  VARCHAR(191) NOT NULL,              -- URL 中 ?t= 的值（32 字节 hex/base64url）
  `wechatOpenId`VARCHAR(191) NULL,                  -- 预留：微信扫码登录后填
  `disabled`    BOOLEAN     NOT NULL DEFAULT false,
  `createdAt`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3) NOT NULL,
  UNIQUE KEY `AppUser_magicToken_key` (`magicToken`),
  UNIQUE KEY `AppUser_wechatOpenId_key` (`wechatOpenId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Session 用**无状态签名 cookie**（不新建表）：
- Cookie 名：`kq_session`
- 值：`base64url(userId):base64url(hmacSha256(userId, SECRET))`
- 验证：拆成两段 → 用 SECRET 重算 HMAC 对比，通过就视为已登录 `userId`。

为什么不用 JWT：我们完全不需要 token 里塞 payload（role 等随查 DB 即可），轻量 HMAC 足够；SECRET 从环境变量 `AUTH_SECRET` 读。

---

## 四、请求链路

```
浏览器 ── /teams?t=abc ──▶ middleware ──▶ set-cookie + 302 /teams
浏览器 ── /teams (cookie) ──▶ middleware ──▶ 放行，附加 x-user-id 头
API route ── getCurrentUser() ──▶ 查 AppUser ──▶ 判权 + 业务处理
```

具体：

1. `src/middleware.ts`：
   - 若 `?t=` 存在且在 `AppUser` 里有效 → `res.cookies.set("kq_session", sign(userId))` + `NextResponse.redirect(去掉 t 参数的 URL)`。
   - 若 cookie 存在且合法 → pass。
   - 若都没有 → 未登录页（`/login`，给个展示二维码/链接的落地页，或直接 401 for API）。

2. `src/lib/auth/session.ts`：
   - `signSession(userId)`、`verifySession(cookie)`。
   - `getCurrentUser(req?)`：server helper，先从 cookie 取 userId，再查 DB 拿到 `AppUser`，缓存到 `ctx`（每请求一次）。

3. `src/lib/auth/rbac.ts`：
   - `can(user, action, resource)`：集中规则，例：
     ```ts
     leave.create: LEADER(自己班组员工) | MANAGER | ADMIN
     leave.approve: MANAGER | ADMIN
     team.readAll: MANAGER | ADMIN
     team.read(teamId): LEADER(自己班组) | MANAGER | ADMIN
     employee.writeInTeam(teamId): LEADER(自己班组) | ADMIN
     ```
   - API route 里统一调 `assert(can(user, 'leave.approve'))`，不满足抛 403。

4. API 返回给前端的人身份：`GET /api/auth/me` → `{id, name, role, teamId}`，UI 据此判断显示哪些按钮。

---

## 五、UI 动作

- **登录落地页 `/login`**：如果用户不带 `?t=` 又没 cookie，跳这里，显示："请从管理员发送给你的链接进入"。附一个二维码区域（选做）。
- **顶部栏**：显示当前登录人 `黄菊 · 1班 班长` + 退出按钮（退出清 cookie）。
- **管理员页 `/admin/users`**（仅 ADMIN 可见）：
  - 列表：姓名/角色/班组/token 片段/禁用开关
  - 操作：新增用户 | 重置 token（一键换发并展示新链接 & 二维码） | 启用/禁用
- **侧栏 nav**：按 `role` 过滤显示。班长只看：工作台 / 排班表（本组） / 请假管理（本组） / 出勤统计（本组）；总经理看全量 + AI 设置；管理员再加 `假期额度` + `用户管理`。

---

## 六、后续迁移到微信

两步走就能切过来：

1. **Web 端接企业微信 / 微信公众号扫码**：
   - 扫码拿到 `openid` → 查 `AppUser.wechatOpenId` → 有就直接签 cookie；没有提示联系管理员绑定。
   - 无需改 `AppUser` 表结构（`wechatOpenId` 已预留）。
2. **小程序端**：
   - 小程序通过 `wx.login()` 拿 `code` → 后端换 `openid` → 同上。
   - 所有 API 改为在 header 带 `X-Session` 而非 cookie 即可兼容。

因此本次 Magic Link 方案在未来是加法，不是推倒重来。

---

## 七、安全考量

- `magicToken` 用 `crypto.randomBytes(32).toString('base64url')`，32 字节 = 256 bit 熵，暴力破解不可行。
- URL 中的 `?t=` 虽然可能留在浏览器历史，但 Middleware 会在首次访问后立刻 302 去掉。另外命中后可选"绑定 User-Agent 指纹"，换设备即失效（折衷是班长换手机又要管理员重置，先不开）。
- Cookie 必须带 `HttpOnly; SameSite=Lax`；若部署在 HTTPS 还要加 `Secure`。
- SECRET 长度 ≥ 32 字节，存 `.env.local`，不入库不入 git。
- 所有 API route 都必须经过 `getCurrentUser + rbac`；没有通过直接返回 401/403，写日志但不泄露用户是否存在。

---

## 八、开发边界（本 PR 范围）

**实现：**
- `AppUser` 表与种子数据（1 个 ADMIN、1 个 MANAGER、示例几个 LEADER）。
- `/api/auth/me`、`/api/auth/users`（ADMIN 限定的 CRUD + 重置 token）。
- Middleware 处理 `?t=` cookie 交换 + 已登录判别。
- `/api/leaves` 的 POST（创建）/ PATCH（审批）接入 rbac：班长只能给本组员工提交；批准仅 MANAGER/ADMIN。
- 管理员页 `/admin/users`（列表 + 生成链接 + 二维码）。
- `/api/auth/me` 前端消费：顶部栏显示当前人 + 退出。
- 登录落地页 `/login`。

**故意不做（避免范围蔓延）：**
- 其它页面的按钮级权限收紧（列表页先只靠接口拦截，UI 看得到但点击拒绝）。
- 企业微信扫码：等真要迁移再开 epic。
- 二维码渲染用前端 SVG 库或服务端生成皆可；此版先给一个简单的前端方案（`/login` 引导页 + 管理员页"复制链接"）。
