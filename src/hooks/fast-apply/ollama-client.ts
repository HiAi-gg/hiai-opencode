import type { FastApplyConfig } from "../../config"

export async function queryOllama(args: {
  originalContent: string
  patch: string
  config: FastApplyConfig
}): Promise<string> {
  const { originalContent, patch, config } = args
  const url = `${config.ollama_url}/api/generate`
  const timeout = config.timeout

  const prompt = [
    "You are a code editor. Given the original file content and a patch/diff description, produce the full updated file content.",
    "Return ONLY the updated file content, nothing else. No explanations, no markdown fences.",
    "",
    "=== ORIGINAL FILE ===",
    originalContent,
    "",
    "=== PATCH ===",
    patch,
    "",
    "=== UPDATED FILE ===",
  ].join("\n")

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        prompt,
        stream: false,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Ollama returned ${response.status}: ${response.statusText}`)
    }

    const data = await response.json() as { response?: string }
    if (!data.response) {
      throw new Error("Ollama returned empty response")
    }

    return data.response
  } finally {
    clearTimeout(timer)
  }
}
