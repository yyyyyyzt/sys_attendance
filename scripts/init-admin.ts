/**
 * 首次启动初始化：在 AppUser 表里插入一个 ADMIN 用户（如果还没有的话）。
 *
 * 用法（已配在 package.json）：
 *   npm run init:admin                      # 默认姓名"初始管理员"
 *   npm run init:admin -- --name=张总       # 自定义姓名
 *   npm run init:admin -- --reset           # 强制重置 token
 *
 * 行为：
 * - 若库里已经存在任意 role=ADMIN 的用户：默认什么都不做（除非加 --reset）。
 * - 若一个都没有：自动新建一个 ADMIN，姓名取 --name 或默认值。
 * - --reset：把库里第一个（按 createdAt 升序）的 ADMIN 重新生成 magicToken。
 *
 * 输出：登录链接 `${BASE_URL}/?t=...`，发给管理员点开即登录。
 *   BASE_URL 默认 http://localhost:3000，可通过 BASE_URL 环境变量覆盖。
 *
 * 这是为了避免"首次启动必须手动写 SQL"的尴尬：
 *   schema → init:admin → npm run dev → 浏览器打开链接，全程零 SQL。
 */
import "dotenv/config"
import { randomUUID, randomBytes } from "crypto"
import mysql from "mysql2/promise"

interface AdminRow extends mysql.RowDataPacket {
  id: string
  name: string
  magicToken: string
}

function stripMysqlUrl(url: string): string {
  const q = url.indexOf("?")
  return q === -1 ? url : url.slice(0, q)
}

function generateMagicToken(): string {
  return randomBytes(32).toString("base64url")
}

function parseArgs(argv: string[]): { name?: string; reset: boolean } {
  let name: string | undefined
  let reset = false
  for (const arg of argv.slice(2)) {
    if (arg === "--reset") reset = true
    else if (arg.startsWith("--name=")) name = arg.slice("--name=".length)
    else if (arg === "--name" && argv[argv.indexOf(arg) + 1]) {
      name = argv[argv.indexOf(arg) + 1]
    }
  }
  return { name, reset }
}

async function main() {
  const args = parseArgs(process.argv)
  const baseUrl = process.env.BASE_URL ?? "http://localhost:3000"
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl?.startsWith("mysql://")) {
    console.error("✗ 请先在 .env 中配置 DATABASE_URL=mysql://user:pass@host:port/database")
    process.exit(1)
  }

  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 16) {
    console.warn(
      "⚠ AUTH_SECRET 未配置或长度不足 16 字节；目前用的是不安全的回退密钥，仅适合本地开发。",
    )
    console.warn("  生产/共享环境请在 .env 写入：AUTH_SECRET=<至少32字节随机串>")
  }

  const conn = await mysql.createConnection({ uri: stripMysqlUrl(dbUrl) })

  try {
    // 先检查 AppUser 表是否存在（提示用户可能还没跑 schema.sql）
    try {
      await conn.execute("SELECT 1 FROM `AppUser` LIMIT 1")
    } catch {
      console.error("✗ 找不到 AppUser 表，请先执行：npm run db:sql -- schema")
      process.exit(1)
    }

    const [existing] = await conn.execute<AdminRow[]>(
      "SELECT `id`, `name`, `magicToken` FROM `AppUser` WHERE `role` = 'ADMIN' ORDER BY `createdAt` ASC LIMIT 1",
    )
    let row: AdminRow

    if (existing.length === 0) {
      // 没有 ADMIN，新建
      const id = randomUUID()
      const token = generateMagicToken()
      const name = args.name ?? "初始管理员"
      await conn.execute(
        `INSERT INTO \`AppUser\` (\`id\`, \`name\`, \`role\`, \`teamId\`, \`magicToken\`, \`disabled\`, \`createdAt\`, \`updatedAt\`)
         VALUES (?, ?, 'ADMIN', NULL, ?, 0, NOW(3), NOW(3))`,
        [id, name, token],
      )
      row = { id, name, magicToken: token } as AdminRow
      console.log(`✓ 已创建初始管理员「${name}」`)
    } else {
      row = existing[0]
      if (args.reset) {
        const token = generateMagicToken()
        await conn.execute(
          "UPDATE `AppUser` SET `magicToken` = ?, `updatedAt` = NOW(3) WHERE `id` = ?",
          [token, row.id],
        )
        row.magicToken = token
        console.log(`✓ 已重置管理员「${row.name}」的登录链接`)
      } else {
        console.log(`✓ 已存在管理员「${row.name}」，直接给出现有链接（如需重置请加 --reset）`)
      }
    }

    const link = `${baseUrl}/?t=${encodeURIComponent(row.magicToken)}`
    console.log("")
    console.log("────────── 管理员登录链接 ──────────")
    console.log(link)
    console.log("─────────────────────────────────────")
    console.log("")
    console.log("使用方式：")
    console.log("  1. 启动开发服务器：npm run dev")
    console.log("  2. 浏览器打开上面的链接 → 系统自动签发 cookie 并跳转到首页")
    console.log("  3. 之后直接访问 http://localhost:3000 即可（cookie 默认 180 天有效）")
    console.log("  4. 进入「用户管理」即可创建班长 / 总经理用户并把链接分发出去")
  } finally {
    await conn.end()
  }
}

main().catch((e) => {
  console.error("✗ 初始化失败：", e)
  process.exit(1)
})
