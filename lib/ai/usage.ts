/** Provider-reported usage only. Unknown usage stays null, never an estimate. */
export type AIUsage = {
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
  cachedInputTokens: number | null
}

export const ZERO_AI_USAGE: AIUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, cachedInputTokens: 0 }

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null
}

export function compatibleUsage(value: unknown): AIUsage {
  const usage = (value || {}) as Record<string, unknown>
  const details = (usage.prompt_tokens_details || {}) as Record<string, unknown>
  return {
    inputTokens: count(usage.prompt_tokens),
    outputTokens: count(usage.completion_tokens),
    totalTokens: count(usage.total_tokens),
    cachedInputTokens: count(details.cached_tokens),
  }
}

export function googleUsage(value: unknown): AIUsage {
  const usage = (value || {}) as Record<string, unknown>
  const candidates = count(usage.candidatesTokenCount)
  const thoughts = count(usage.thoughtsTokenCount)
  return {
    inputTokens: count(usage.promptTokenCount),
    outputTokens: candidates === null ? null : candidates + (thoughts || 0),
    totalTokens: count(usage.totalTokenCount),
    cachedInputTokens: count(usage.cachedContentTokenCount),
  }
}
