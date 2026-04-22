import { normalizeModelFormat } from "../../shared/model-format-normalizer"
import { normalizeModelID } from "../../shared/model-normalization"

const ANTHROPIC_PREFIX = "anthropic/"

let CLAUDE_CODE_ALIAS_MAP = new Map<string, string>();

/**
 * Initializes Claude model aliases from the provided configuration.
 */
export function initializeClaudeAliases(aliases?: Record<string, string>) {
  if (aliases) {
    CLAUDE_CODE_ALIAS_MAP = new Map(Object.entries(aliases));
  }
}

function mapClaudeModelString(model: string | undefined): string | undefined {
  if (!model) return undefined

  const trimmed = model.trim()
  if (trimmed.length === 0) return undefined

  if (trimmed === "inherit") return undefined

  const aliasResult = CLAUDE_CODE_ALIAS_MAP.get(trimmed.toLowerCase())
  if (aliasResult) return aliasResult

  if (trimmed.includes("/")) {
    const [providerID, ...modelParts] = trimmed.split("/")
    const modelID = modelParts.join("/")

    if (providerID.length === 0 || modelID.length === 0) return trimmed

    return modelID.startsWith("claude-")
      ? `${providerID}/${normalizeModelID(modelID)}`
      : trimmed
  }

  const normalized = normalizeModelID(trimmed)

  if (normalized.startsWith("claude-")) {
    return `${ANTHROPIC_PREFIX}${normalized}`
  }

  return undefined
}

export function mapClaudeModelToOpenCode(
  model: string | undefined
): { providerID: string; modelID: string } | undefined {
  const mappedModel = mapClaudeModelString(model)
  return mappedModel ? normalizeModelFormat(mappedModel) : undefined
}
