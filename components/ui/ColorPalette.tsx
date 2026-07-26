"use client"

interface ColorPaletteProps {
  value: string
  onChange: (color: string) => void
}

const PALETTES = [
  { name: "Blanco", color: "#ffffff" },
  { name: "Marfil", color: "#f5f1e8" },
  { name: "Azul tinta", color: "#1e3a5f" },
  { name: "Pizarra", color: "#334155" },
  { name: "Carbón", color: "#1f2937" },
  { name: "Bosque", color: "#285943" },
  { name: "Oliva", color: "#64734a" },
  { name: "Terracota", color: "#a45135" },
  { name: "Burdeos", color: "#7f1d1d" },
  { name: "Azul clásico", color: "#2563eb" },
]

function normalizeColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : "#334155"
}

export default function ColorPalette({ value, onChange }: ColorPaletteProps) {
  const normalized = normalizeColor(value)

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label className="block text-[11px] font-semibold tracking-widest text-muted2">COLOR</label>
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
              className={`h-8 w-8 rounded-full border transition-transform hover:scale-105 ${selected ? "scale-110 ring-2 ring-blue-500/35 ring-offset-2 ring-offset-[var(--bg-card)]" : ""}`}
              style={{ backgroundColor: palette.color, borderColor: palette.color === "#ffffff" ? "#cbd5e1" : "rgba(15,23,42,.16)" }}
            />
          )
        })}
        <label className="relative flex h-8 w-8 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-soft" title="Elegir color personalizado">
          <span className="pointer-events-none text-sm font-black text-muted2">＋</span>
          <input type="color" value={normalized} onChange={(event) => onChange(event.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label="Color personalizado" />
        </label>
      </div>
    </div>
  )
}
