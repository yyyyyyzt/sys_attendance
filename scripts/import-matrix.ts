#!/usr/bin/env npx tsx
/**
 * 从项目根目录的 example1.csv / example2.csv 灌库（mysql2）
 * 用法：npm run db:import
 */
import "dotenv/config"
import { defaultExampleCsvPaths, importRealSchedulesFromCsv } from "../src/lib/scheduling/import-real-data"

async function main() {
  const paths = defaultExampleCsvPaths()
  const result = await importRealSchedulesFromCsv({
    matrixCsvPath: paths.matrixCsvPath,
    shiftsCsvPath: paths.shiftsCsvPath,
    clearFirst: true,
  })
  console.log(JSON.stringify(result, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
