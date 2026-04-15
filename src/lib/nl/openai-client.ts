import OpenAI from "openai"

const globalForOpenAI = globalThis as unknown as { openai: OpenAI }

function createClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY ?? "",
    baseURL: process.env.OPENAI_BASE_URL,
  })
}

export const openai = globalForOpenAI.openai ?? createClient()

if (process.env.NODE_ENV !== "production") {
  globalForOpenAI.openai = openai
}

export const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini"

export function isConfigured(): boolean {
  const key = process.env.OPENAI_API_KEY ?? ""
  return key.length > 0 && key !== "sk-your-api-key-here"
}
