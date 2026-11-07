import { createHash } from "node:crypto"

export const TRAINING_POLICY_VERSION = "2026-11-06-v1"
export type TrainingMessage = { role: "system" | "user" | "assistant"; content: string }
// Reject, rather than pretend that regex redaction reliably anonymizes arbitrary documents.
export function trainingTextAllowed(text: string): boolean {
  if (!text.trim() || text.length > 24000) return false
  return ![
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    /\b\d{1,2}[.\s]?\d{3}[.\s]?\d{3}-[\dkK]\b/,
    /(?:\+?56\s?[29]\s?\d[\d\s-]{6,}|\b\d{8,}\b)/,
    /(?:api[_ -]?key|access[_ -]?token|secret|password|contraseña|service[_ -]?role|private[_ -]?key)\s*[:=]\s*\S+/i,
    /\b(?:sk-|gsk_|AIza|eyJ)[A-Za-z0-9_-]{16,}/,
    /-----BEGIN .*PRIVATE KEY-----/,
    /\b(?:RUT|RUN|domicilio|diagnóstico|diagnostico|apoderado|estudiante llamado|alumn[oa] llamad[oa]|mi nombre es|me llamo|nombre del (?:alumno|estudiante|docente))\b/i,
    /https?:\/\/\S+/i,
  ].some((pattern) => pattern.test(text))
}

export function prepareTrainingPair(prompt: string, answer: string): TrainingMessage[] | null {
  if (prompt.length < 8 || answer.length < 12 || !trainingTextAllowed(prompt) || !trainingTextAllowed(answer)) return null
  return [{ role: "system", content: "Eres EDUAI, asistente educativo. Usa solo información verificada y respeta los objetivos proporcionados." },
    { role: "user", content: prompt.trim() }, { role: "assistant", content: answer.trim() }]
}
export function trainingFingerprint(messages: TrainingMessage[]): string {
  return createHash("sha256").update(JSON.stringify(messages)).digest("hex")
}
export function trainingSplit(messages: TrainingMessage[]): "train" | "validation" {
  // Group by prompt, so alternate answers never cross the train/validation boundary.
  const prompt = messages.filter(m => m.role === "user").map(m => m.content.toLowerCase().replace(/\s+/g," ").trim()).join("\n")
  return parseInt(createHash("md5").update(prompt).digest("hex").slice(0,8),16) % 10 === 0 ? "validation" : "train"
}

export function validatedTrainingPair(value: unknown): TrainingMessage[] | null {
  if (!Array.isArray(value) || value.length !== 3) return null
  const roles = ["system", "user", "assistant"]
  if (!value.every((m,i) => m && typeof m === "object" && m.role === roles[i] && typeof m.content === "string")) return null
  return prepareTrainingPair(value[1].content, value[2].content)
}
