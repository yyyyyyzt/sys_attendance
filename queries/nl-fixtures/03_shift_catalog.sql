-- 全局班次目录（无 teamId）
-- 对应 GET /api/shifts、排班页班次下拉数据源

SELECT `code`, `name`, `startTime`, `endTime`, `isCrossNight`,
       `requiredCount`, `workMinutes`, `remark`
FROM `Shift`
ORDER BY `code` ASC;
