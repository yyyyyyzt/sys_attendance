nl-fixtures：自然语言意图与可执行 SQL 的对照（人工校验用）

使用方式
1. 在 MySQL 客户端连接与 .env 相同的库。
2. 按需修改各 .sql 文件顶部的日期、班组名、员工名等变量（或 WHERE 条件）。
3. 执行 SQL，结果应与 App / NL executor 同类查询口径一致（见各文件注释）。

文件对照
- 01_view_schedule_window.sql  ↔ view_schedule（按日期窗、可选班组/员工）
- 02_leave_requests.sql       ↔ GET /api/leaves、create_leave 结果核对
- 03_shift_catalog.sql         ↔ 全局班次主数据
- 04_leave_gaps_calendar.sql   ↔ leaveService.detectGaps / GET /api/leaves/gaps（仅 scheduled 人数 vs requiredCount）

注意：executor 中 view_schedule 等为应用层查询；SQL 为等价核对用，边界（如 take 50）以代码为准。
