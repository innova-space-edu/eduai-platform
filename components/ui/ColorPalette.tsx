// src/components/ui/ColorPalette.tsx
"use client"

import { useState } from "react"

interface ColorPaletteProps {
  value: string
  onChange: (color: string) => void
}

const PALETTES = [
  { name: "Azul",      color: "#3b82f6", bg: "bg-blue-500"    },
  { name: "Índigo",    color: "#6366f1", bg: "bg-indigo-500"  },
  { name: "Violeta",   color: "#8b5cf6", bg: "bg-violet-500"  },
  { name: "Rosa",      color: "#ec4899", bg: "bg-pink-500"    },
  { name: "Rojo",      color: "#ef4444", bg: "bg-red-500"     },
  { name: "Naranja",   color: "#f97316", bg: "bg-orange-500"  },
  { name: "Ámbar",     color: "#f59e0b", bg: "bg-amber-500"   },
  { name: "Verde",     color: "#22c55e", bg: "bg-green-500"   },
  { name: "Esmeralda", color: "#10b981", bg: "bg-emerald-500" },
  { name: "Cian",      color: "#06b6d4", bg: "bg-cyan-500"    },
  { name: "Gris",      color: "var(--text-muted)", bg: ""               },
  { name: "Negro",     color: "var(--bg-card-soft)", bg: "bg-card-soft-theme"   },
]

export default function ColorPalette({ value, onChange }: ColorPaletteProps) {
  return (
    <div>
      <label className="text-muted2 text-[11px] font-semibold tracking-widest block mb-2">COLOR</label>
      <div className="flex gap-1.5 flex-wrap">
        {PALETTES.map(p => (
          <button
            key={p.color}
            onClick={() => onChange(p.color)}
            title={p.name}
            className={`w-7 h-7 rounded-lg transition-all border-2 ${
              value === p.color ? "border-medium scale-110 shadow-md ring-2 ring-offset-1 ring-medium" : "border-transparent hover:scale-105 hover:border-soft"
            }`}
            style={{ backgroundColor: p.color }}
          />
        ))}
      </div>
    </div>
  )
}
