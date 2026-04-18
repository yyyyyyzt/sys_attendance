import mysql from "mysql2/promise"

function stripMysqlUrl(url: string): string {
  const q = url.indexOf("?")
  return q === -1 ? url : url.slice(0, q)
}

function createPool(): mysql.Pool {
  const raw = process.env.DATABASE_URL
  if (!raw?.startsWith("mysql://")) {
    throw new Error("DATABASE_URL 需为 mysql://user:pass@host:port/database")
  }
  return mysql.createPool({
    uri: stripMysqlUrl(raw),
    waitForConnections: true,
    connectionLimit: 10,
    enableKeepAlive: true,
  })
}

const globalForMysql = globalThis as unknown as { __kaoqinPool?: mysql.Pool }

export function getPool(): mysql.Pool {
  if (!globalForMysql.__kaoqinPool) {
    globalForMysql.__kaoqinPool = createPool()
  }
  return globalForMysql.__kaoqinPool
}

/** mysql2 占位参数（各 repo 动态拼装，用宽松类型避免与驱动重载冲突） */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlParams = any[]

export async function queryRows<T extends mysql.RowDataPacket>(
  sql: string,
  params: SqlParams = [],
): Promise<T[]> {
  const [rows] = await getPool().execute<T[]>(sql, params)
  return rows as T[]
}

export async function queryOne<T extends mysql.RowDataPacket>(
  sql: string,
  params: SqlParams = [],
): Promise<T | null> {
  const rows = await queryRows<T>(sql, params)
  return rows[0] ?? null
}

export async function execute(sql: string, params: SqlParams = []): Promise<mysql.ResultSetHeader> {
  const [res] = await getPool().execute(sql, params)
  return res as mysql.ResultSetHeader
}
