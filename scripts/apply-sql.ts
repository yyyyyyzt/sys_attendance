/**
 * 执行 db/schema.sql / db/seed.sql（需 DATABASE_URL=mysql://...）
 * 用法：npx tsx --require dotenv/config scripts/apply-sql.ts [schema|seed|all]
 */
import "dotenv/config"
import fs from "fs"
import path from "path"
import mysql from "mysql2/promise"

function stripMysqlUrl(url: string): string {
  const q = url.indexOf("?")
  return q === -1 ? url : url.slice(0, q)
}

async function main() {
  const mode = process.argv[2] ?? "all"
  if (!["schema", "seed", "all"].includes(mode)) {
    console.error("用法: npx tsx --require dotenv/config scripts/apply-sql.ts [schema|seed|all]")
    process.exit(1)
  }
  const raw = process.env.DATABASE_URL
  if (!raw?.startsWith("mysql://")) {
    console.error("请配置 DATABASE_URL=mysql://...")
    process.exit(1)
  }
  const uri = stripMysqlUrl(raw)
  const conn = await mysql.createConnection({ uri, multipleStatements: true })
  const root = process.cwd()
  try {
    if (mode === "schema" || mode === "all") {
      const sql = fs.readFileSync(path.join(root, "db", "schema.sql"), "utf-8")
      await conn.query(sql)
      console.log("✓ 已执行 db/schema.sql")
    }
    if (mode === "seed" || mode === "all") {
      const sql = fs.readFileSync(path.join(root, "db", "seed.sql"), "utf-8")
      await conn.query(sql)
      console.log("✓ 已执行 db/seed.sql")
    }
  } finally {
    await conn.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
