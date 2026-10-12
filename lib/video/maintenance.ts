// Mantenimiento global de Video Studio: requiere revisión administrativa para reactivar.
export const VIDEO_STUDIO_MAINTENANCE = true

export const VIDEO_STUDIO_MAINTENANCE_RESPONSE = {
  ok: false,
  code: "VIDEO_STUDIO_MAINTENANCE",
  error: "La generación de videos de EDUAI está en mantenimiento y no admite nuevos trabajos ni pagos.",
  maintenance: true,
} as const
