import { NextResponse, type NextRequest } from "next/server"
import { SESSION_COOKIE, SESSION_MAX_AGE_SEC, signSession, verifySession } from "@/lib/auth/session-core"

const PUBLIC_PATHS = ["/login", "/favicon.ico", "/_next", "/api/auth/exchange"]

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))
}

export async function proxy(req: NextRequest) {
  const { pathname, search, origin } = req.nextUrl
  const url = req.nextUrl.clone()

  // 若 URL 中带了 ?t=xxx，尝试换成 cookie
  const tokenParam = url.searchParams.get("t")
  if (tokenParam) {
    // 这里不直接访问数据库（middleware 无法用 mysql2），改为 302 到专用端点
    // /api/auth/exchange?t=xxx&next=/xxx
    const exchangeUrl = new URL("/api/auth/exchange", origin)
    exchangeUrl.searchParams.set("t", tokenParam)
    // 去掉 ?t= 的原始目标
    url.searchParams.delete("t")
    exchangeUrl.searchParams.set("next", `${url.pathname}${url.search}`)
    return NextResponse.redirect(exchangeUrl)
  }

  // 登录态校验（只限制页面路由与非公开 API；公开路径直接放行）
  if (isPublic(pathname)) return NextResponse.next()

  const cookie = req.cookies.get(SESSION_COOKIE)?.value ?? null
  const userId = await verifySession(cookie)
  if (!userId) {
    // API 请求直接返 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "未登录" }, { status: 401 })
    }
    const loginUrl = new URL("/login", origin)
    loginUrl.searchParams.set("from", pathname + search)
    return NextResponse.redirect(loginUrl)
  }

  // 签名有效，可选滑动续期
  const res = NextResponse.next()
  res.cookies.set(SESSION_COOKIE, await signSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  })
  return res
}

export const config = {
  matcher: [
    /*
     * 跳过静态资源与 Next.js 内部路径；其它路径都走 middleware。
     * 注意：/api/auth/exchange 需要可公开访问，由 isPublic() 处理。
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}
