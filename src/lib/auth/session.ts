/**
 * Node runtime 专用的 auth helper：访问数据库取当前登录用户。
 * 在 Edge middleware 里请用 `session-core`。
 */

import type { NextRequest } from "next/server"
import { cookies as nextCookies } from "next/headers"
import { appUserRepo, type AppUser } from "@/lib/repos/app-user"
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session-core"

export { SESSION_COOKIE, SESSION_MAX_AGE_SEC, signSession, verifySession } from "@/lib/auth/session-core"

/**
 * 获取当前登录用户：
 * - 不传 req：从 next/headers 的 cookies 读取（server components / route handlers 默认可用）
 * - 传 req：从 NextRequest.cookies 读取（在自定义 handler 里方便）
 */
export async function getCurrentUser(req?: NextRequest): Promise<AppUser | null> {
  let raw: string | undefined | null
  if (req) {
    raw = req.cookies.get(SESSION_COOKIE)?.value ?? null
  } else {
    const store = await nextCookies()
    raw = store.get(SESSION_COOKIE)?.value ?? null
  }
  const userId = await verifySession(raw)
  if (!userId) return null
  const user = await appUserRepo.findById(userId)
  if (!user || user.disabled) return null
  return user
}
