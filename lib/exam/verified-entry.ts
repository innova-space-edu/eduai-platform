import { createHash, createHmac, timingSafeEqual } from "node:crypto"

export function normalizeRosterText(value: unknown) {
  return String(value ?? "").normalize("NFD").replace(/\p{M}/gu, "")
    .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()
}

export function hashExamAccessCode(value: unknown) {
  const secret = process.env.EXAM_ACCESS_CODE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error("Falta la configuración de códigos docentes")
  const code = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12)
  return createHash("sha256").update("eduai-exam-access:").update(secret).update(":").update(code).digest("hex")
}

export function attemptCredential(examId: string, attemptId: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error("Falta la configuración de intentos")
  return createHmac("sha256", secret).update(JSON.stringify(["exam-attempt-v1", examId, attemptId])).digest("hex")
}

export function hasAttemptCredential(examId: string, attemptId: string, value: unknown) {
  if (!examId || !attemptId || typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) return false
  return timingSafeEqual(Buffer.from(value, "hex"), Buffer.from(attemptCredential(examId, attemptId), "hex"))
}

export function remainingExamSeconds(startedAt: string, duration: number, now = Date.now()) {
  const started = Date.parse(startedAt)
  return Number.isFinite(started) ? Math.max(0, Math.min(duration, Math.ceil((started + duration * 1000 - now) / 1000))) : 0
}
