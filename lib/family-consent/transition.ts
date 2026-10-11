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
