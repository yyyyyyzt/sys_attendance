/**
 * AI 知识库 / 自定义提示词 存储
 * 使用 JSON 文件持久化，存储在项目根目录 data/ai-knowledge.json
 */

import fs from "fs"
import path from "path"

const DATA_DIR = path.join(process.cwd(), "data")
const KNOWLEDGE_FILE = path.join(DATA_DIR, "ai-knowledge.json")

export interface AIKnowledge {
  /** 业务术语对照，如「夜班=晚班」 */
  terminology: string
  /** 业务规则说明，如「每组每天至少3人在岗」 */
  rules: string
  /** 自由提示词，直接注入 system prompt */
  customPrompt: string
  /** 最后更新时间 */
  updatedAt: string
}

const DEFAULT_KNOWLEDGE: AIKnowledge = {
  terminology: `- 夜班 = 晚班
- A组 = 客服A组
- B组 = 客服B组
- 调休 = 请假（类型：事假）`,
  rules: `- 每个班次每天至少需要满足 requiredCount 人在岗
- 请假审批后自动将对应排班状态改为"请假"
- 如果用户没说具体日期，默认指今天`,
  customPrompt: "",
  updatedAt: new Date().toISOString(),
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

export function readKnowledge(): AIKnowledge {
  try {
    ensureDir()
    if (!fs.existsSync(KNOWLEDGE_FILE)) {
      writeKnowledge(DEFAULT_KNOWLEDGE)
      return DEFAULT_KNOWLEDGE
    }
    const raw = fs.readFileSync(KNOWLEDGE_FILE, "utf-8")
    return { ...DEFAULT_KNOWLEDGE, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_KNOWLEDGE
  }
}

export function writeKnowledge(data: Partial<AIKnowledge>): AIKnowledge {
  ensureDir()
  const existing = fs.existsSync(KNOWLEDGE_FILE)
    ? JSON.parse(fs.readFileSync(KNOWLEDGE_FILE, "utf-8")) as AIKnowledge
    : DEFAULT_KNOWLEDGE
  const merged: AIKnowledge = {
    ...existing,
    ...data,
    updatedAt: new Date().toISOString(),
  }
  fs.writeFileSync(KNOWLEDGE_FILE, JSON.stringify(merged, null, 2), "utf-8")
  return merged
}

/** 将知识库格式化为可注入 system prompt 的文本 */
export function formatKnowledgeForPrompt(): string {
  const k = readKnowledge()
  const sections: string[] = []

  if (k.terminology.trim()) {
    sections.push(`## 业务术语对照\n${k.terminology.trim()}`)
  }
  if (k.rules.trim()) {
    sections.push(`## 业务规则\n${k.rules.trim()}`)
  }
  if (k.customPrompt.trim()) {
    sections.push(`## 额外指令\n${k.customPrompt.trim()}`)
  }

  return sections.length > 0
    ? `\n\n--- 以下是管理员配置的业务知识 ---\n${sections.join("\n\n")}`
    : ""
}
