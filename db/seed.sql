-- 最小演示数据（在空库执行 schema 后执行；重复执行会因主键/唯一键报错，属预期）
SET NAMES utf8mb4;

INSERT INTO `Department` (`id`, `name`, `createdAt`) VALUES
('11111111-1111-4111-8111-111111111101', '演示部门', NOW(3));

INSERT INTO `Team` (`id`, `name`, `description`, `departmentId`, `leaveThreshold`, `createdAt`) VALUES
('22222222-2222-4222-8222-222222222201', '1班', NULL, '11111111-1111-4111-8111-111111111101', 3, NOW(3));

INSERT INTO `Shift` (`id`, `code`, `name`, `startTime`, `endTime`, `isCrossNight`, `requiredCount`, `workMinutes`, `segmentsJson`, `remark`, `createdAt`) VALUES
('33333333-3333-4333-8333-333333333301', '班1A', '班1A', '08:30', '18:30', false, 1, 480, CAST('[{"start":"08:30","end":"18:30"}]' AS JSON), '演示', NOW(3));

INSERT INTO `Employee` (`id`, `name`, `teamId`, `position`, `skills`, `status`, `createdAt`, `updatedAt`) VALUES
('44444444-4444-4444-8444-444444444401', '演示员工', '22222222-2222-4222-8222-222222222201', '组员', CAST('[]' AS JSON), 'active', NOW(3), NOW(3));

INSERT INTO `LeavePolicyRule` (`id`, `leaveType`, `maxDays`, `isPaid`, `requiresProof`, `note`, `createdAt`, `updatedAt`) VALUES
('55555555-5555-4555-8555-555555555501', 'ANNUAL', NULL, true, false, '年假', NOW(3), NOW(3)),
('55555555-5555-4555-8555-555555555502', 'CHILD_CARE', NULL, true, false, '育儿假', NOW(3), NOW(3)),
('55555555-5555-4555-8555-555555555503', 'SICK', NULL, false, true, '病假', NOW(3), NOW(3)),
('55555555-5555-4555-8555-555555555504', 'PERSONAL', NULL, false, false, '事假', NOW(3), NOW(3)),
('55555555-5555-4555-8555-555555555505', 'MARRIAGE', 10, true, false, '婚假', NOW(3), NOW(3)),
('55555555-5555-4555-8555-555555555506', 'NURSING', NULL, true, false, '护理假', NOW(3), NOW(3)),
('55555555-5555-4555-8555-555555555507', 'PATERNITY', NULL, true, false, '陪产假', NOW(3), NOW(3)),
('55555555-5555-4555-8555-555555555508', 'BEREAVEMENT', NULL, true, false, '丧假', NOW(3), NOW(3));
