/** 将 Json 字段安全转为 string[] */
export function jsonToStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string")
  }
  return []
}

/** 将 string[] 写入 MySQL JSON 列（配合 CAST(? AS JSON) 或 JSON_QUOTE） */
export function stringArrayToJsonValue(arr: string[]): string {
  return JSON.stringify(arr)
}
