import type { Prisma } from "@/generated/prisma/client"

/** 将 Prisma Json 字段安全转为 string[] */
export function jsonToStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string")
  }
  return []
}

/** 将 string[] 转为可写入 Prisma Json 字段的值 */
export function stringArrayToJson(arr: string[]): Prisma.InputJsonValue {
  return arr as Prisma.InputJsonValue
}
