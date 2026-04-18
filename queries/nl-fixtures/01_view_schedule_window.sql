-- NL 示例：查看 2026-04-01～2026-04-07 某班组排班
-- 等价于 prisma.schedule.findMany：shiftDate 在区间内，可选 teamId / employeeId
-- 修改下面常量后执行

SET @from = '2026-04-01';
SET @to = '2026-04-07';
-- SET @team_name = '%一班%';  -- 可选，注释掉则不限班组
-- SET @emp_name = '%张三%';  -- 可选

SELECT
  s.`shiftDate` AS 日期,
  e.`name` AS 员工,
  t.`name` AS 班组,
  CONCAT(sh.`code`, ' ', sh.`name`) AS 班次,
  CONCAT(sh.`startTime`, '-', sh.`endTime`) AS 时段,
  s.`status` AS 状态
FROM `Schedule` s
JOIN `Employee` e ON e.`id` = s.`employeeId`
JOIN `Team` t ON t.`id` = s.`teamId`
JOIN `Shift` sh ON sh.`id` = s.`shiftId`
WHERE s.`shiftDate` BETWEEN @from AND @to
  -- AND t.`name` LIKE @team_name
  -- AND e.`name` LIKE @emp_name
ORDER BY s.`shiftDate` ASC, t.`name`, e.`name`
LIMIT 200;
