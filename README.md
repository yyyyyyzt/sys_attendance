# 智能排班考勤助手

面向客服行业的内部排班、请假与出勤管理。角色包含班长 / 总经理 / 管理员，Magic Link 无感登录。

## 快速开始

```bash
npm install

# 在 .env 中配置 DATABASE_URL 与 AUTH_SECRET
# DATABASE_URL=mysql://user:pass@127.0.0.1:3306/kaoqin
# AUTH_SECRET=至少16字节的随机串

npm run setup   # 建表 + 种子数据 + 创建初始管理员
npm run dev     # 终端会输出管理员登录链接，浏览器打开即可
```

## 常用命令

| 命令 | 用途 |
|------|------|
| `npm run dev` | 开发服务器 |
| `npm run build` | 生产构建 |
| `npm run lint` / `npx tsc --noEmit` | 静态检查 |
| `npm run setup` | 首次本地：`db:init` + 初始化管理员 |
| `npm run db:init` | 仅执行 `db/schema.sql` + `db/seed.sql` |
| `npm run init:admin` | 仅创建 / 获取 / 重置管理员链接 |
| `npm run test:api` | 接口集成测试（需先 `npm run dev`） |

`init:admin` 可选参数：

```bash
npm run init:admin                 # 无 ADMIN 时自动创建并打印链接
npm run init:admin -- --name=张总  # 自定义首次管理员姓名
npm run init:admin -- --reset      # 强制重置首位 ADMIN 的登录链接
```

矩阵排班可从应用内「导入导出」页上传 CSV/xlsx；根目录 `example1.csv` / `example2.csv` 仅作格式参考。

## 技术栈

Next.js（App Router）· TypeScript 严格模式 · Tailwind CSS · ShadCN UI · MySQL 8 + mysql2 · OpenAI Function Call。
