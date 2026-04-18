# 智能排班考勤小助手 - 开发进度

## 阶段1: 项目初始化 & 基础架构 (MVP基础)
- [x] 创建项目目录结构
- [x] 初始化Git仓库
- [x] 创建Harness配置文件
- [x] MySQL 表结构（`db/schema.sql`）与 mysql2 数据访问层
- [x] 配置Tailwind和ShadCN
- [x] 创建基础布局组件

## 阶段2: MVP Web端 - 核心功能
- [x] 员工&班组管理基础功能
- [x] 班次配置管理
- [x] 排班表基础查看功能
- [x] Excel导入/导出功能
- [x] 基础的排班编辑功能

## 阶段3: 请假管理模块
- [x] 员工请假申请功能
- [x] 领导审批功能
- [x] 请假自动映射到排班
- [x] 人员缺口检测与预警
- [x] 替补人员推荐

## 阶段4: 出勤监控模块
- [x] 月度出勤统计
- [x] 出勤预警配置
- [x] 可视化数据看板
- [x] 异常情况提醒

## 阶段5: 响应式适配 & 多端支持
- [x] 移动端响应式适配
- [x] PC端高级功能扩展
- [x] 移动端精简视图

## 阶段6: 自然语言交互模块
- [x] NL2Action自然语言解析
- [x] 大模型Function Call集成
- [x] 对话式操作界面
- [x] 自然语言指令测试

## 阶段7: 高级功能优化
- [ ] 智能排班建议算法
- [ ] 历史数据统计分析
- [ ] 数据备份与恢复
- [ ] 用户权限管理

## 阶段7.5: 班长 / 总经理业务流闭环（本轮优化，详见 docs/optimization-plan.md）
- [ ] 默认出勤推导：`deriveDailyAttendance` + `monthlyStats` 回退分支
- [ ] 假期规则引擎：消耗型扣减（年假/婚假/育儿假）+ 上限型校验（丧假/陪产假等）
- [ ] `LeaveBalanceAccount` 仓储与初始化接口
- [ ] 班长聚合接口：`/api/employees/:id/leave-panel`、`/api/leaves/day-overview`、`/api/leaves/pending`
- [ ] NL 工具扩展：`view_leave_panel`、`view_team_day_leaves`、`view_pending_leaves`、`view_team_day_attendance`
- [ ] `approve_leave` 支持 startDate 精确定位 + 多 pending 回问
- [ ] 请假页员工假期面板 Drawer + 待审批徽标
- [ ] 通过 `docs/nl-test-cases.md` 的全部测试用例 + 三件套门禁