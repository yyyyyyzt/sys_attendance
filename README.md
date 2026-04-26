# 智能排班考勤助手

面向客服行业的内部排班 + 请假 + 出勤工具。班长 / 总经理 / 管理员三级角色，Magic Link 无感登录。

## 快速开始

```bash
npm install

# 在 .env 中配置 DATABASE_URL 与 AUTH_SECRET
# DATABASE_URL=mysql://user:pass@127.0.0.1:3306/kaoqin
# AUTH_SECRET=至少16字节的随机串

npm run setup     # 一键执行：建表 + 种子 + 创建初始管理员
npm run dev       # 启动开发服务器，浏览器打开 setup 输出的管理员登录链接
```

终端会输出形如 `http://localhost:3000/?t=...` 的链接，浏览器打开即自动登录为管理员。之后进 `/admin/users` 创建班长 / 总经理用户。

## 常用命令

| 命令 | 用途 |
|---|---|
| `npm run dev` | 开发服务器 |
| `npm run build` | 生产构建 |
| `npm run lint` / `npx tsc --noEmit` | 静态检查 |
| `npm run setup` | 建表 + 种子 + 初始化管理员（首次启动用） |
| `npm run init:admin` | 仅创建/获取/重置管理员链接（参数见下文） |
| `npm run db:sql` | 仅执行 schema + seed |
| `npm run db:import` | 从根目录 `example1.csv` + `example2.csv` 全量导入排班 |
| `npm run sample:mysql` | 仅导入少量样本行 |
| `npm run test:api` | 运行接口级集成测试（需先 `npm run dev`） |

`init:admin` 支持的开关：

```bash
npm run init:admin                 # 没有 ADMIN 时自动创建并打印链接
npm run init:admin -- --name=张总  # 自定义首次创建的管理员姓名
npm run init:admin -- --reset      # 强制重置首位 ADMIN 的登录链接
```

## 文档

- [`docs/local-testing-guide.md`](docs/local-testing-guide.md) — 本地自测完整路径
- [`docs/permission-design.md`](docs/permission-design.md) — Magic Link + RBAC 权限方案
- [`docs/optimization-plan.md`](docs/optimization-plan.md) — 班长/总经理两级业务流优化计划
- [`docs/nl-test-cases.md`](docs/nl-test-cases.md) — 自然语言指令测试用例
- [`docs/api-test-cases.md`](docs/api-test-cases.md) — 接口级集成测试用例
- [`progress.md`](progress.md) — 阶段进度

## 技术栈

Next.js 16 (App Router) · TypeScript 严格模式 · Tailwind CSS 4 · ShadCN UI · MySQL 8 + mysql2 · OpenAI Function Call。
