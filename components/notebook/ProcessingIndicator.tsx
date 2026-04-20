"use client"
// components/notebook/ProcessingIndicator.tsx
// Indicador visual de procesamiento — circular con colores animados

interface ProcessingIndicatorProps {
  count:    number   // fuentes procesando
  total?:   number   // total de fuentes
  size?:    "sm" | "md"
}

export default function ProcessingIndicator({
  count,
  total,
  size = "sm",
}: ProcessingIndicatorProps) {
  if (count === 0) return null

  const dim = size === "sm" ? 18 : 24
  const stroke = size === "sm" ? 2.5 : 3

  return (
    <div className="flex items-center gap-2">
      {/* Spinner con gradiente */}
      <span style={{ display: "inline-block", width: dim, height: dim, position: "relative" }}>
        <svg
          width={dim}
          height={dim}
          viewBox="0 0 36 36"
          style={{ animation: "nb-spin 0.9s linear infinite", display: "block" }}
        >
          <defs>
            <linearGradient id="nb-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor="#3b82f6" />
              <stop offset="40%"  stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
          </defs>
          {/* Track */}
          <circle
            cx="18" cy="18" r="14"
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth={stroke}
          />
          {/* Arc animado */}
          <circle
            cx="18" cy="18" r="14"
            fill="none"
            stroke="url(#nb-grad)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray="44 44"
            strokeDashoffset="0"
            transform="rotate(-90 18 18)"
          />
        </svg>
        <style>{`
          @keyframes nb-spin {
            from { transform: rotate(0deg); }
            to   { transform: rotate(360deg); }
          }
        `}</style>
      </span>

      <span
        className="text-xs font-medium"
        style={{
          background: "linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        {total ? `Procesando ${count}/${total}` : `Procesando ${count}`}
      </span>
    </div>
  )
}

// ─── Variante inline para SourceCard ─────────────────────────────────────────

export function InlineSpinner({ color = "#3b82f6" }: { color?: string }) {
  return (
    <span style={{ display: "inline-block", width: 12, height: 12, position: "relative" }}>
      <svg
        width={12} height={12}
        viewBox="0 0 36 36"
        style={{ animation: "nb-spin 0.9s linear infinite", display: "block" }}
      >
        <defs>
          <linearGradient id="nb-grad-inline" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor={color} />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <circle cx="18" cy="18" r="14" fill="none"
          stroke="rgba(255,255,255,0.15)" strokeWidth="4" />
        <circle cx="18" cy="18" r="14" fill="none"
          stroke={`url(#nb-grad-inline)`} strokeWidth="4"
          strokeLinecap="round" strokeDasharray="44 44"
          transform="rotate(-90 18 18)" />
      </svg>
    </span>
  )
}

// ─── Barra de progreso para batch ────────────────────────────────────────────

export function BatchProgressBar({
  current,
  total,
  label,
}: {
  current: number
  total:   number
  label?:  string
}) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
            {label}
          </span>
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {current}/{total}
          </span>
        </div>
      )}
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height: 4, background: "var(--bg-card-soft)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width:      `${pct}%`,
            background: "linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4)",
          }}
        />
      </div>
    </div>
  )
}
