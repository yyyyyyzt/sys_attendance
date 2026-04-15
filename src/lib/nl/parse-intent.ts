/** 自然语言意图解析（关键词启发式，阶段 6 替换为 LLM） */

export type IntentType =
  | "viewSchedule"
  | "requestLeave"
  | "approveLeave"
  | "exportSchedule"
  | "viewAttendance"
  | "addSchedule"
  | "unknown"

export interface Intent {
  type: IntentType
  label: string
  params: Record<string, string>
  raw: string
}

interface Rule {
  type: IntentType
  label: string
  keywords: string[]
  extractors?: { key: string; pattern: RegExp }[]
}

const rules: Rule[] = [
  {
    type: "viewSchedule",
    label: "查看排班",
    keywords: ["查看排班", "排班", "班表", "看看排班"],
    extractors: [
      { key: "name", pattern: /(?:查看|看看)(.{2,4}?)(?:的|排班|班表)/ },
      { key: "month", pattern: /(\d{1,2})月/ },
    ],
  },
  {
    type: "requestLeave",
    label: "请假申请",
    keywords: ["请假", "调休", "休假"],
    extractors: [
      { key: "date", pattern: /(\d{1,2}月\d{1,2}[日号])/ },
      { key: "reason", pattern: /请假[，,]?\s*(.+)/ },
    ],
  },
  {
    type: "approveLeave",
    label: "审批请假",
    keywords: ["批准", "审批", "同意请假"],
    extractors: [
      { key: "name", pattern: /(?:批准|审批|同意)(.{2,4}?)(?:的|请假)/ },
    ],
  },
  {
    type: "exportSchedule",
    label: "导出排班",
    keywords: ["导出", "下载排班", "导出排班", "导出班表"],
    extractors: [
      { key: "period", pattern: /(本周|本月|这周|这个月|\d{1,2}月)/ },
    ],
  },
  {
    type: "viewAttendance",
    label: "查看出勤",
    keywords: ["出勤", "考勤", "出勤不够", "出勤统计"],
    extractors: [
      { key: "name", pattern: /(.{2,4}?)(?:的|出勤|考勤)/ },
    ],
  },
  {
    type: "addSchedule",
    label: "新建排班",
    keywords: ["排班给", "安排", "加班"],
    extractors: [
      { key: "name", pattern: /(?:安排|排班给)(.{2,4})/ },
      { key: "shift", pattern: /(早班|中班|晚班|夜班)/ },
    ],
  },
]

export function parseIntent(input: string): Intent {
  const text = input.trim()
  if (!text) return { type: "unknown", label: "未识别", params: {}, raw: text }

  for (const rule of rules) {
    const matched = rule.keywords.some((kw) => text.includes(kw))
    if (!matched) continue

    const params: Record<string, string> = {}
    if (rule.extractors) {
      for (const ext of rule.extractors) {
        const m = text.match(ext.pattern)
        if (m?.[1]) params[ext.key] = m[1]
      }
    }
    return { type: rule.type, label: rule.label, params, raw: text }
  }

  return { type: "unknown", label: "未识别", params: {}, raw: text }
}
