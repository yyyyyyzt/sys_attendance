/**
 * 依次执行 db/schema.sql 与 db/seed.sql（需配置 DATABASE_URL=mysql://...）
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
  const raw = process.env.DATABASE_URL
  if (!raw?.startsWith("mysql://")) {
    console.error("请配置 DATABASE_URL=mysql://...")
    process.exit(1)
  }
  const uri = stripMysqlUrl(raw)
  const conn = await mysql.createConnection({ uri, multipleStatements: true })
  const root = process.cwd()
  try {
    const schemaSql = fs.readFileSync(path.join(root, "db", "schema.sql"), "utf-8")
    await conn.query(schemaSql)
    console.log("✓ 已执行 db/schema.sql")
    const seedSql = fs.readFileSync(path.join(root, "db", "seed.sql"), "utf-8")
    await conn.query(seedSql)
    console.log("✓ 已执行 db/seed.sql")
  } finally {
    await conn.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
