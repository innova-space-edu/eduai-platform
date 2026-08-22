import { createHash } from "node:crypto"

const FINGERPRINT_VERSION = 1

function normalizeString(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/[\t ]+/g, " ").trim()
}

function canonicalize(value: unknown): unknown {
  if (value === null || value === undefined) return value ?? null
  if (typeof value === "string") return normalizeString(value)
  if (typeof value === "number" || typeof value === "boolean") return value
  if (Array.isArray(value)) return value.map(canonicalize)
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, child]) => child !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, canonicalize(child)])
    )
  }
  return String(value)
}

export function stableJson(value: unknown): string {
  return JSON.stringify(canonicalize(value))
}

export function generationFingerprint(input: {
  capability: string
  payload: unknown
  model?: string | null
  provider?: string | null
  scopeKey?: string | null
  schemaVersion?: number
}): string {
  const canonical = stableJson({
    v: input.schemaVersion ?? FINGERPRINT_VERSION,
    capability: input.capability,
    provider: input.provider ?? null,
    model: input.model ?? null,
    scopeKey: input.scopeKey ?? null,
    payload: input.payload,
  })
  return createHash("sha256").update(canonical).digest("hex")
}

export function fileSha256(buffer: Buffer | Uint8Array): string {
  return createHash("sha256").update(buffer).digest("hex")
}
