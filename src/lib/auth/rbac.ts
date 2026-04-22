import type { AppUser } from "@/lib/repos/app-user"

/**
 * 基于角色的访问控制。
 *
 * 角色：
 * - LEADER：读写"本班组"员工/排班/请假；能提交请假；不能审批请假。
 * - MANAGER：只读所有数据；审批请假；不能删员工；不能管理用户。
 * - ADMIN：所有权限（含用户管理、假期额度分配）。
 */

type Action =
  | "team.readAll"
  | "team.read"          // resource: { teamId }
  | "team.write"         // 创建/编辑班组，仅 ADMIN
  | "employee.readAll"
  | "employee.read"      // resource: { teamId }
  | "employee.writeInTeam" // 对本组员工增删改 LEADER/ADMIN（管理员全权）
  | "schedule.readAll"
  | "schedule.read"      // resource: { teamId }
  | "schedule.writeInTeam"
  | "leave.readAll"
  | "leave.read"         // resource: { teamId }
  | "leave.create"       // resource: { teamId }
  | "leave.approve"      // MANAGER/ADMIN
  | "leave.cancel"       // 自己班组 or MANAGER/ADMIN
  | "attendance.read"    // resource: { teamId }
  | "leave.quota.write"  // 假期额度分配 ADMIN
  | "user.manage"        // /admin/users ADMIN
  | "admin.settings"     // AI 设置等 ADMIN/MANAGER

export interface ResourceCtx {
  teamId?: string | null
}

export function can(user: AppUser | null, action: Action, resource?: ResourceCtx): boolean {
  if (!user) return false
  if (user.disabled) return false
  if (user.role === "ADMIN") return true

  switch (action) {
    // 全局读
    case "team.readAll":
    case "employee.readAll":
    case "schedule.readAll":
    case "leave.readAll":
      return user.role === "MANAGER"

    // 与 teamId 相关的读
    case "team.read":
    case "employee.read":
    case "schedule.read":
    case "leave.read":
    case "attendance.read":
      if (user.role === "MANAGER") return true
      return user.role === "LEADER" && !!resource?.teamId && resource.teamId === user.teamId

    // 班组内写操作（班长 / 管理员；管理员已在上面早返回）
    case "employee.writeInTeam":
    case "schedule.writeInTeam":
    case "leave.create":
      return user.role === "LEADER" && !!resource?.teamId && resource.teamId === user.teamId

    // 审批 / 撤销
    case "leave.approve":
      return user.role === "MANAGER"
    case "leave.cancel":
      if (user.role === "MANAGER") return true
      return user.role === "LEADER" && !!resource?.teamId && resource.teamId === user.teamId

    // ADMIN 专属
    case "team.write":
    case "leave.quota.write":
    case "user.manage":
      return false
    case "admin.settings":
      return user.role === "MANAGER"
  }

  return false
}

export class AuthError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export function assert(user: AppUser | null, action: Action, resource?: ResourceCtx): AppUser {
  if (!user) throw new AuthError("未登录", 401)
  if (!can(user, action, resource)) throw new AuthError("无此权限", 403)
  return user
}
