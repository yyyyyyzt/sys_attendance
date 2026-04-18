/** 与 MySQL ENUM(`LeaveRequest`.`leaveType`) 一致 */
export const LEAVE_TYPES = [
  "ANNUAL",
  "CHILD_CARE",
  "SICK",
  "PERSONAL",
  "MARRIAGE",
  "NURSING",
  "PATERNITY",
  "BEREAVEMENT",
] as const

export type LeaveType = (typeof LEAVE_TYPES)[number]

export function isLeaveType(v: string): v is LeaveType {
  return (LEAVE_TYPES as readonly string[]).includes(v)
}
