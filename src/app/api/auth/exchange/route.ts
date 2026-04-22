import { NextResponse } from "next/server"
import { appUserRepo } from "@/lib/repos/app-user"
import { SESSION_COOKIE, SESSION_MAX_AGE_SEC, signSession } from "@/lib/auth/session"

/**
 * GET /api/auth/exchange?t=xxx&next=/somewhere
 *
 * 公开端点：根据 magicToken 签发 session cookie，然后 302 到 next。
 * 即使 token 无效也要带点友好信息跳 /login，而不是直接 404。
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const token = searchParams.get("t") ?? ""
  const next = searchParams.get("next") || "/"

  if (!token) {
    return NextResponse.redirect(new URL("/login", origin))
  }

  const user = await appUserRepo.findByToken(token)
  if (!user) {
    const loginUrl = new URL("/login", origin)
    loginUrl.searchParams.set("error", "invalid-token")
    return NextResponse.redirect(loginUrl)
  }

  const targetUrl = (() => {
    try {
      return new URL(next, origin)
    } catch {
      return new URL("/", origin)
    }
  })()

  const res = NextResponse.redirect(targetUrl)
  res.cookies.set(SESSION_COOKIE, await signSession(user.id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  })
  return res
}
