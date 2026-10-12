/**
 * Transición interna de autorizaciones, zona horaria America/Santiago (UTC-03 en estas fechas).
 * Cuentas creadas hasta el 11/10/2026 23:59:59 hora de Chile conservan
 * el acceso anterior por el nuevo requisito hasta el 15/11/2026 00:00.
 * No concede permisos opcionales ni omite controles de seguridad preexistentes.
 */
export const LEGACY_ACCOUNT_CUTOFF_MS = Date.parse("2026-10-12T03:00:00.000Z")
export const LEGACY_CONSENT_DEADLINE_MS = Date.parse("2026-11-15T03:00:00.000Z")

export function hasLegacyConsentGrace(createdAt: string | null | undefined, nowMs = Date.now()): boolean {
  if (!createdAt || nowMs >= LEGACY_CONSENT_DEADLINE_MS) return false
  const createdMs = Date.parse(createdAt)
  return Number.isFinite(createdMs) && createdMs < LEGACY_ACCOUNT_CUTOFF_MS
}

/** Detecta altas nuevas mediante la instantánea de edad protegida por Supabase.
 * En altas nuevas, captured_at coincide con created_at; los usuarios anteriores
 * se cargaron retrospectivamente. No confía en metadatos editables por el usuario.
 */
export function shouldEnforceFamilyConsent(
  createdAt: string | null | undefined,
  capturedAt: string | null | undefined,
  enforceLegacy: boolean,
  nowMs = Date.now(),
): boolean {
  const createdMs = createdAt ? Date.parse(createdAt) : Number.NaN
  if (!Number.isFinite(createdMs)) return true
  if (createdMs >= LEGACY_ACCOUNT_CUTOFF_MS) return true
  const capturedMs = capturedAt ? Date.parse(capturedAt) : Number.NaN
  if (Number.isFinite(capturedMs) && Math.abs(capturedMs - createdMs) <= 60_000) return true
  return enforceLegacy && !hasLegacyConsentGrace(createdAt, nowMs)
}
