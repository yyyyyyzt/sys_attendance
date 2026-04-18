-- 请假缺口：与 leaveService.detectGaps 一致
-- 对每个 Team × 全局 Shift × 日历日：仅统计 Schedule.status = 'scheduled' 的人数；
-- 若人数 < Shift.requiredCount 则视为缺口（API 返回这些行；未缺口的不返回）。
-- MySQL 8+ RECURSIVE。请修改 @d_from / @d_to。

SET @d_from = '2026-04-01';
SET @d_to = '2026-04-07';

WITH RECURSIVE dates AS (
  SELECT CAST(@d_from AS DATE) AS d
  UNION ALL
  SELECT DATE_ADD(d, INTERVAL 1 DAY) FROM dates WHERE d < CAST(@d_to AS DATE)
),
counts AS (
  SELECT `teamId`, `shiftId`, `shiftDate`, COUNT(*) AS cnt
  FROM `Schedule`
  WHERE `status` = 'scheduled'
  GROUP BY `teamId`, `shiftId`, `shiftDate`
)
SELECT
  DATE_FORMAT(dt.d, '%Y-%m-%d') AS shiftDate,
  sh.`id` AS shiftId,
  sh.`name` AS shiftName,
  t.`id` AS teamId,
  t.`name` AS teamName,
  sh.`requiredCount` AS requiredCount,
  COALESCE(c.cnt, 0) AS currentCount,
  (sh.`requiredCount` - COALESCE(c.cnt, 0)) AS gap
FROM `Team` t
CROSS JOIN `Shift` sh
CROSS JOIN dates dt
LEFT JOIN counts c
  ON c.`teamId` = t.`id` AND c.`shiftId` = sh.`id` AND c.`shiftDate` = DATE_FORMAT(dt.d, '%Y-%m-%d')
WHERE sh.`requiredCount` > COALESCE(c.cnt, 0)
ORDER BY shiftDate, teamName, sh.`code`;
