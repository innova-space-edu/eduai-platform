// app/examen/resultados/[id]/RiskBadgeV2.tsx

"use client"

type RiskLevel = "clean" | "low" | "medium" | "high" | "critical"

type Props = {
  level?: string | null
  score?: number | null
  compact?: boolean
}

function normalizeRiskLevel(level?: string | null): RiskLevel {
  const value = String(level || "clean").toLowerCase()

  if (value === "critical") return "critical"
  if (value === "high") return "high"
  if (value === "medium") return "medium"
  if (value === "low") return "low"
  return "clean"
}

function getTone(level: RiskLevel) {
  switch (level) {
    case "critical":
      return {
        wrapper: "border-red-400/30 bg-red-500/15 text-red-700",
        dot: "bg-red-400",
        label: "Crítico",
      }
    case "high":
      return {
        wrapper: "border-orange-400/30 bg-orange-500/15 text-orange-700",
        dot: "bg-orange-400",
        label: "Alto",
      }
    case "medium":
      return {
        wrapper: "border-yellow-400/30 bg-yellow-500/15 text-yellow-700",
        dot: "bg-yellow-400",
        label: "Medio",
      }
    case "low":
      return {
        wrapper: "border-sky-400/30 bg-sky-500/15 text-sky-200",
        dot: "bg-sky-400",
        label: "Bajo",
      }
    default:
      return {
        wrapper: "border-emerald-400/30 bg-emerald-500/15 text-emerald-700",
        dot: "bg-emerald-400",
        label: "Limpio",
      }
  }
}

export default function RiskBadgeV2({
  level = "clean",
  score = 0,
  compact = false,
}: Props) {
  const normalized = normalizeRiskLevel(level)
  const tone = getTone(normalized)

  if (compact) {
    return (
      <span
        className={[
          "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold",
          tone.wrapper,
        ].join(" ")}
      >
        <span className={["h-2 w-2 rounded-full", tone.dot].join(" ")} />
        {tone.label}
      </span>
    )
  }

  return (
    <div
      className={[
        "inline-flex items-center gap-3 rounded-2xl border px-3 py-2 text-sm font-semibold",
        tone.wrapper,
      ].join(" ")}
    >
      <span className={["h-2.5 w-2.5 rounded-full", tone.dot].join(" ")} />
      <span>Riesgo {tone.label}</span>
      <span className="rounded-full border border-soft bg-card-soft-theme px-2 py-0.5 text-xs">
        Score {score ?? 0}
      </span>
    </div>
  )
}
