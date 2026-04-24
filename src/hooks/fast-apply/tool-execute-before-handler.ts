import type { FastApplyConfig } from "../../config"
import { queryOllama } from "./ollama-client"
import { log } from "../../shared"
import { existsSync, readFileSync } from "fs"

export async function handleFastApplyToolExecuteBefore(args: {
  input: { tool: string; sessionID: string; callID: string }
  output: { args: Record<string, unknown> }
  config: FastApplyConfig
}): Promise<void> {
  const { input, output, config } = args
  const normalizedTool = input.tool.toLowerCase()

  if (normalizedTool !== "apply_patch" && normalizedTool !== "applypatch") {
    return
  }

  const patchArgs = output.args as { filePath?: string; path?: string; file_path?: string; patch?: string }
  const filePath = patchArgs.filePath ?? patchArgs.path ?? patchArgs.file_path
  const patch = patchArgs.patch

  if (!filePath || !patch) {
    log("[fast-apply] Skipping: missing filePath or patch", {
      sessionID: input.sessionID,
      callID: input.callID,
      hasFilePath: !!filePath,
      hasPatch: !!patch,
    })
    return
  }

  if (!existsSync(filePath)) {
    log("[fast-apply] Skipping: file does not exist (new file)", {
      sessionID: input.sessionID,
      callID: input.callID,
      filePath,
    })
    return
  }

  let originalContent: string
  try {
    originalContent = readFileSync(filePath, "utf-8")
  } catch (err) {
    log("[fast-apply] Failed to read file, falling back to default", {
      sessionID: input.sessionID,
      callID: input.callID,
      filePath,
      error: String(err),
    })
    return
  }

  try {
    log("[fast-apply] Sending to Ollama", {
      sessionID: input.sessionID,
      callID: input.callID,
      filePath,
      model: config.model,
    })

    const newContent = await queryOllama({
      originalContent,
      patch,
      config,
    })

    output.args.content = newContent
    output.args.patch = undefined

    log("[fast-apply] Patch replaced with Ollama result", {
      sessionID: input.sessionID,
      callID: input.callID,
      filePath,
      originalLength: originalContent.length,
      newLength: newContent.length,
    })
  } catch (err) {
    log("[fast-apply] Ollama failed, falling back to default apply_patch", {
      sessionID: input.sessionID,
      callID: input.callID,
      filePath,
      error: String(err),
    })
  }
}
