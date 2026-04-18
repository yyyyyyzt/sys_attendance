-- NL / API：请假列表（状态、日期窗）
-- 与 leaveRepo.findAll 口径一致：status / employeeId / startDate-endDate 与区间重叠

SET @status = 'pending';       -- pending | approved | rejected | cancelled
SET @from = '2026-04-01';
SET @to = '2026-04-30';

SELECT
  lr.`id`,
  e.`name` AS employeeName,
  lr.`leaveType`,
  lr.`startDate`,
  lr.`endDate`,
  lr.`hours`,
  lr.`status`,
  lr.`cancelledAt`,
  lr.`createdAt`
FROM `LeaveRequest` lr
JOIN `Employee` e ON e.`id` = lr.`employeeId`
WHERE lr.`status` = @status
  AND lr.`startDate` <= @to
  AND lr.`endDate` >= @from
ORDER BY lr.`createdAt` DESC
LIMIT 100;
