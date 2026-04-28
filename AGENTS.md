# 智能排班考勤小助手 - Agent 项目说明

## 项目概述

面向客服行业的智能排班考勤系统：多班组 24 小时轮班的排班、请假、出勤管理。

## 技术栈

- 框架: Next.js（App Router）
- 语言: TypeScript（严格模式）
- 样式: Tailwind CSS
- UI: ShadCN UI
- 数据库: MySQL + mysql2（`DATABASE_URL`，见 `.env`）；表结构与种子见 `db/schema.sql`、`db/seed.sql`
- AI: OpenAI Function Call

## 目录结构

- `db/schema.sql`、`db/seed.sql`: 建表与演示数据
- `src/app/`: 页面与 API
- `src/components/`: 组件
- `src/lib/`: 工具与数据访问（repos）

## 常用命令

- `npm install`: 安装依赖
- `npm run dev`: 启动开发服务器
- `npm run build`: 生产构建
- `npm run lint`: 代码检查
- `npx tsc --noEmit`: 类型检查
- `npm run db:init`: 执行 `db/schema.sql` + `db/seed.sql`
- `npm run setup`: `db:init` + `init:admin`（首次本地环境推荐）
- `npm run test:api`: 接口集成测试（需先启动 dev）

## 质量门禁

变更后建议通过：类型检查、lint、可构建、核心流程可手动验证。

## 核心能力：自然语言操作

用户输入自然语言 → 前端解析为结构化意图 → 执行操作。

示例：查看某员工某月排班、请假申请、审批请假、导出排班、查看出勤异常等。
