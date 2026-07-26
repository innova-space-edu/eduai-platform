"use client"

interface ColorPaletteProps {
  value: string
  onChange: (color: string) => void
}

const PALETTES = [
  { name: "Azul", color: "#3b82f6" },
  { name: "Índigo", color: "#6366f1" },
  { name: "Violeta", color: "#8b5cf6" },
  { name: "Rosa", color: "#ec4899" },
  { name: "Rojo", color: "#ef4444" },
  { name: "Naranja", color: "#f97316" },
  { name: "Ámbar", color: "#f59e0b" },
  { name: "Verde", color: "#22c55e" },
  { name: "Esmeralda", color: "#10b981" },
  { name: "Cian", color: "#06b6d4" },
  { name: "Gris", color: "#475569" },
  { name: "Negro", color: "#0f172a" },
]

function normalizeColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : "#3b82f6"
}

export default function ColorPalette({ value, onChange }: ColorPaletteProps) {
  const normalized = normalizeColor(value)

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label className="block text-[11px] font-semibold tracking-widest text-muted2">COLOR PRINCIPAL</label>
        <span className="font-mono text-[10px] uppercase text-muted2">{normalized}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {PALETTES.map((palette) => {
          const selected = normalized === palette.color.toLowerCase()
          return (
            <button
              key={palette.color}
              type="button"
              onClick={() => onChange(palette.color)}
              title={palette.name}
              aria-label={`Usar color ${palette.name}`}
              aria-pressed={selected}
              className={`h-8 w-8 rounded-full border-2 transition-all ${selected ? "scale-110 border-main shadow-md ring-2 ring-blue-500/30 ring-offset-2 ring-offset-[var(--bg-card)]" : "border-white/70 hover:scale-105"}`}
              style={{ backgroundColor: palette.color }}
            />
          )
        })}
        <label className="relative flex h-8 w-8 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-soft" title="Elegir color personalizado">
          <span className="pointer-events-none text-sm font-black text-muted2">＋</span>
          <input
            type="color"
            value={normalized}
            onChange={(event) => onChange(event.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label="Color personalizado"
          />
        </label>
      </div>
    </div>
  )
}
