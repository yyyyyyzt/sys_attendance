/**
 * 与 runtime 无关的 session 签名/校验。
 *
 * 使用 Web Crypto API（`globalThis.crypto.subtle`），
 * 在 Next.js Edge Runtime（middleware）和 Node.js runtime（route handlers、server components）
 * 下都能使用。
 */

export const SESSION_COOKIE = "kq_session"
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 180 // 180 天

function getSecret(): string {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 16) {
    return "dev-insecure-secret-please-set-AUTH_SECRET-in-env"
  }
  return secret
}

function base64urlFromBytes(bytes: Uint8Array): string {
  let bin = ""
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  const base64 = typeof btoa !== "undefined"
    ? btoa(bin)
    : Buffer.from(bytes).toString("base64")
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function bytesFromBase64url(s: string): Uint8Array {
  const base64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4)
  if (typeof atob !== "undefined") {
    const bin = atob(base64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  }
  return new Uint8Array(Buffer.from(base64, "base64"))
}

function utf8Encode(s: string): Uint8Array {
  return new TextEncoder().encode(s)
}
function utf8Decode(b: Uint8Array): string {
  return new TextDecoder().decode(b)
}

async function importKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    toArrayBuffer(utf8Encode(getSecret())),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  )
}

/** 把 Uint8Array 复制到严格的 ArrayBuffer，避免 lib.dom 对 SharedArrayBuffer 的类型收紧 */
function toArrayBuffer(u: Uint8Array): ArrayBuffer {
  const buf = new ArrayBuffer(u.byteLength)
  new Uint8Array(buf).set(u)
  return buf
}

/** 签出形如 `base64url(userId).hmac` 的 cookie 值 */
export async function signSession(userId: string): Promise<string> {
  const key = await importKey()
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, toArrayBuffer(utf8Encode(userId))),
  )
  return `${base64urlFromBytes(utf8Encode(userId))}.${base64urlFromBytes(sig)}`
}

/** 验证 cookie 并返回 userId；失败返回 null */
export async function verifySession(raw: string | undefined | null): Promise<string | null> {
  if (!raw) return null
  const idx = raw.indexOf(".")
  if (idx < 0) return null
  const idPart = raw.slice(0, idx)
  const hmacPart = raw.slice(idx + 1)
  let userId: string
  try {
    userId = utf8Decode(bytesFromBase64url(idPart))
  } catch {
    return null
  }
  let sig: Uint8Array
  try {
    sig = bytesFromBase64url(hmacPart)
  } catch {
    return null
  }
  const key = await importKey()
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    toArrayBuffer(sig),
    toArrayBuffer(utf8Encode(userId)),
  )
  return ok ? userId : null
}
