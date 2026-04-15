# 智能排班考勤小助手 - Agent项目说明书

## 项目概述
这是一个面向客服行业的智能排班考勤系统，解决多班组24小时轮班的排班、请假、出勤管理问题。

## 技术栈
- 框架: Next.js 15 (App Router)
- 语言: TypeScript (严格模式)
- 样式: Tailwind CSS
- UI组件: ShadCN UI
- 数据库: Prisma + SQLite
- AI: OpenAI Function Call

## 目录结构
- prisma/schema.prisma: 数据库模型
- src/app/: 页面和API
- src/components/: 组件
- src/lib/: 工具函数

## 常用命令
- npm install: 安装依赖
- npm run dev: 启动开发服务器
- npm run build: 生产构建
- npm run lint: 代码检查
- npx tsc --noEmit: 类型检查
- npx prisma migrate dev: 数据库迁移

## 开发流程
必须严格按照 progress.md 中的阶段顺序开发，完成一个阶段并验证通过后，才能进入下一个阶段。

## 质量门禁
每个阶段完成后，必须通过以下验证:
1. 类型检查通过
2. 代码检查通过
3. 项目能正常构建
4. 功能能正常运行，无明显bug

## 核心特色：全局自然语言操作框
用户输入自然语言 → 前端解析为结构化意图 → 执行操作
示例：
- 查看张三4月排班
- 我要请4月20号假
- 批准李四的请假
- 导出本周排班
- 查看出勤不够的人
