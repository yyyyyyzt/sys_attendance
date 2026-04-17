import { NextResponse } from "next/server"

function devDebugEnabled(): boolean {
  return process.env.NODE_ENV === "development"
}

function debugPayload(err: unknown): Record<string, unknown> | undefined {
  if (!devDebugEnabled()) return undefined
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
    }
  }
  return { detail: String(err) }
}

/**
 * 统一 API 异常响应：生产环境仅返回 userMessage；开发环境额外 console.error 并在 body 中附带 debug。
 */
export function apiRouteError(
  routeLabel: string,
  err: unknown,
  userMessage: string,
  status: number,
): NextResponse {
  if (devDebugEnabled()) {
    console.error(`[API ${routeLabel}]`, err)
  }
  const body: Record<string, unknown> = { error: userMessage }
  const dbg = debugPayload(err)
  if (dbg) body.debug = dbg
  return NextResponse.json(body, { status })
}
