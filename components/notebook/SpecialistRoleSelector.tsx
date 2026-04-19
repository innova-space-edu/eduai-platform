"use client"
// components/notebook/SpecialistRoleSelector.tsx
import { useState } from "react"
import { ChevronDown, Check } from "lucide-react"

const PRESET_ROLES = [
  { label: "Especialista general",            value: "Especialista general" },
  { label: "Especialista en historia",        value: "Especialista en historia" },
  { label: "Especialista en ciencias",        value: "Especialista en ciencias naturales" },
  { label: "Especialista en matemáticas",     value: "Especialista en matemáticas" },
  { label: "Especialista en educación parvularia", value: "Especialista en educación parvularia" },
  { label: "Especialista en lenguaje",        value: "Especialista en lenguaje y comunicación" },
  { label: "Especialista en biología",        value: "Especialista en biología" },
  { label: "Especialista en química",         value: "Especialista en química" },
  { label: "Especialista en física",          value: "Especialista en física" },
  { label: "Especialista en geografía",       value: "Especialista en geografía" },
  { label: "Especialista en educación",       value: "Especialista en pedagogía y educación" },
]

interface Props {
  value:    string
  onChange: (value: string) => Promise<void>
}

export default function SpecialistRoleSelector({ value, onChange }: Props) {
  const [open,    setOpen]    = useState(false)
  const [custom,  setCustom]  = useState("")
  const [loading, setLoading] = useState(false)

  const select = async (role: string) => {
    setLoading(true)
    try {
      await onChange(role)
    } finally {
      setLoading(false)
      setOpen(false)
      setCustom("")
    }
  }

  const current = PRESET_ROLES.find((r) => r.value === value)?.label ?? value

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
        style={{
          background:  "var(--bg-card-soft)",
          border:      "1px solid var(--border-medium)",
          color:       "var(--text-secondary)",
        }}
      >
        🎓
        <span className="max-w-[160px] truncate">{current}</span>
        <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute top-full mt-1 left-0 z-20 w-60 rounded-2xl border shadow-lg overflow-hidden"
            style={{
              background:   "var(--bg-card)",
              borderColor:  "var(--border-medium)",
              boxShadow:    "var(--shadow-lg)",
            }}
          >
            <div className="p-2 flex flex-col gap-0.5 max-h-64 overflow-y-auto">
              {PRESET_ROLES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => select(r.value)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-left transition-all"
                  style={{
                    background: value === r.value ? "rgba(37,99,235,0.08)" : "transparent",
                    color:      "var(--text-secondary)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--bg-card-soft)"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = value === r.value
                      ? "rgba(37,99,235,0.08)"
                      : "transparent"
                  }}
                >
                  {value === r.value && <Check size={11} style={{ color: "var(--accent-blue)" }} />}
                  {value !== r.value && <span className="w-[11px]" />}
                  {r.label}
                </button>
              ))}
            </div>

            {/* Custom input */}
            <div className="p-2 border-t border-soft">
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Rol personalizado..."
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && custom.trim()) select(`Especialista en ${custom.trim()}`)
                  }}
                  className="flex-1 px-2.5 py-1.5 rounded-lg text-xs outline-none"
                  style={{
                    background: "var(--bg-input)",
                    border:     "1px solid var(--border-soft)",
                    color:      "var(--text-primary)",
                  }}
                />
                <button
                  onClick={() => custom.trim() && select(`Especialista en ${custom.trim()}`)}
                  disabled={!custom.trim() || loading}
                  className="px-2 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40"
                  style={{ background: "var(--accent-blue)" }}
                >
                  ✓
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
