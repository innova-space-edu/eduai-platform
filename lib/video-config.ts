export type VideoMode = "text_to_video" | "image_to_video"
export type VideoPlan = "free" | "pro" | "pro_max"
export type VideoJobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "blocked"
  | "canceled"

export const VIDEO_MIN_DURATION = 2
export const VIDEO_MAX_DURATION = 10
export const VIDEO_DEFAULT_DURATION = 6

export const VIDEO_DAILY_LIMITS: Record<VideoPlan, number> = {
  free: 1,
  pro: 5,
  pro_max: 15,
}

export const VIDEO_ALLOWED_MODES: VideoMode[] = [
  "text_to_video",
  "image_to_video",
]

export function normalizeMode(value: string | null | undefined): VideoMode {
  if (value === "image_to_video") return "image_to_video"
  return "text_to_video"
}

export function normalizePlan(value: string | null | undefined): VideoPlan {
  if (value === "pro") return "pro"
  if (value === "pro_max") return "pro_max"
  return "free"
}

export function normalizeDuration(value: number | string | null | undefined): number {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number(value)
      : VIDEO_DEFAULT_DURATION

  if (!Number.isFinite(numeric)) return VIDEO_DEFAULT_DURATION

  const rounded = Math.round(numeric)

  if (rounded < VIDEO_MIN_DURATION) return VIDEO_MIN_DURATION
  if (rounded > VIDEO_MAX_DURATION) return VIDEO_MAX_DURATION

  return rounded
}

export function requiresImage(mode: VideoMode): boolean {
  return mode === "image_to_video"
}
