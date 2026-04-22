import { randomUUID, randomBytes } from "crypto"
import { queryRows, queryOne, execute } from "@/lib/db"
import type { RowDataPacket } from "mysql2"

export type AppRole = "LEADER" | "MANAGER" | "ADMIN"

type UserRow = RowDataPacket & {
  id: string
  name: string
  role: AppRole
  teamId: string | null
  magicToken: string
  wechatOpenId: string | null
  disabled: boolean | number
  createdAt: Date
  updatedAt: Date
  teamName?: string | null
}

export interface AppUser {
  id: string
  name: string
  role: AppRole
  teamId: string | null
  teamName: string | null
  magicToken: string
  wechatOpenId: string | null
  disabled: boolean
  createdAt: Date
  updatedAt: Date
}

function mapUser(r: UserRow): AppUser {
  return {
    id: r.id,
    name: r.name,
    role: r.role,
    teamId: r.teamId,
    teamName: r.teamName ?? null,
    magicToken: r.magicToken,
    wechatOpenId: r.wechatOpenId,
    disabled: Boolean(r.disabled),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

const BASE_SQL = `
  SELECT u.*, t.\`name\` AS teamName
  FROM \`AppUser\` u
  LEFT JOIN \`Team\` t ON t.\`id\` = u.\`teamId\`
`

export const appUserRepo = {
  async findAll(): Promise<AppUser[]> {
    const rows = await queryRows<UserRow>(`${BASE_SQL} ORDER BY u.\`role\` ASC, u.\`createdAt\` ASC`)
    return rows.map(mapUser)
  },

  async findById(id: string): Promise<AppUser | null> {
    const r = await queryOne<UserRow>(`${BASE_SQL} WHERE u.\`id\` = ? LIMIT 1`, [id])
    return r ? mapUser(r) : null
  },

  async findByToken(token: string): Promise<AppUser | null> {
    const r = await queryOne<UserRow>(
      `${BASE_SQL} WHERE u.\`magicToken\` = ? AND u.\`disabled\` = 0 LIMIT 1`,
      [token],
    )
    return r ? mapUser(r) : null
  },

  async findByWechatOpenId(openId: string): Promise<AppUser | null> {
    const r = await queryOne<UserRow>(
      `${BASE_SQL} WHERE u.\`wechatOpenId\` = ? AND u.\`disabled\` = 0 LIMIT 1`,
      [openId],
    )
    return r ? mapUser(r) : null
  },

  async create(params: {
    name: string
    role: AppRole
    teamId?: string | null
  }): Promise<AppUser> {
    const id = randomUUID()
    const token = generateMagicToken()
    await execute(
      `INSERT INTO \`AppUser\` (\`id\`, \`name\`, \`role\`, \`teamId\`, \`magicToken\`, \`disabled\`, \`createdAt\`, \`updatedAt\`)
       VALUES (?, ?, ?, ?, ?, 0, NOW(3), NOW(3))`,
      [id, params.name, params.role, params.teamId ?? null, token],
    )
    const created = await this.findById(id)
    if (!created) throw new Error("用户创建失败")
    return created
  },

  async update(id: string, patch: {
    name?: string
    role?: AppRole
    teamId?: string | null
    disabled?: boolean
  }): Promise<AppUser> {
    const sets: string[] = ["`updatedAt` = NOW(3)"]
    const params: unknown[] = []
    if (patch.name !== undefined) { sets.push("`name` = ?"); params.push(patch.name) }
    if (patch.role !== undefined) { sets.push("`role` = ?"); params.push(patch.role) }
    if (patch.teamId !== undefined) { sets.push("`teamId` = ?"); params.push(patch.teamId) }
    if (patch.disabled !== undefined) { sets.push("`disabled` = ?"); params.push(patch.disabled ? 1 : 0) }
    params.push(id)
    await execute(`UPDATE \`AppUser\` SET ${sets.join(", ")} WHERE \`id\` = ?`, params)
    const updated = await this.findById(id)
    if (!updated) throw new Error("用户更新后查询失败")
    return updated
  },

  async resetToken(id: string): Promise<AppUser> {
    const token = generateMagicToken()
    await execute(
      "UPDATE `AppUser` SET `magicToken` = ?, `updatedAt` = NOW(3) WHERE `id` = ?",
      [token, id],
    )
    const updated = await this.findById(id)
    if (!updated) throw new Error("用户不存在")
    return updated
  },

  async delete(id: string): Promise<void> {
    await execute("DELETE FROM `AppUser` WHERE `id` = ?", [id])
  },
}

/** 生成 32 字节随机 token（base64url，去掉 = 等填充） */
export function generateMagicToken(): string {
  return randomBytes(32).toString("base64url")
}
