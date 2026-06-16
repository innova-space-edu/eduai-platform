"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

function parseExamId(pathname: string | null) {
  const match = pathname?.match(/^\/examen\/editar\/([^/?#]+)/)
  return match?.[1] || ""
}

function normalizeMinutes(value: unknown, fallback = 30) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(1, Math.min(240, Math.round(numeric)))
}

export default function EditExamTimeButton() {
  const pathname = usePathname()
  const examId = useMemo(() => parseExamId(pathname), [pathname])
  const isEditExamPage = Boolean(examId)

  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [currentMinutes, setCurrentMinutes] = useState<number | null>(null)
  const [draftMinutes, setDraftMinutes] = useState("120")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (!isEditExamPage) return

    let cancelled = false
    async function loadExamTime() {
      setLoading(true)
      setError("")
      try {
        const response = await fetch(`/api/agents/examen-docente?examId=${examId}`)
        const data = await response.json().catch(() => ({}))
        const minutes = normalizeMinutes(data?.exam?.settings?.timeLimit, 30)
        if (cancelled) return
        setCurrentMinutes(minutes)
        setDraftMinutes(String(minutes))
      } catch {
        if (!cancelled) setError("No se pudo cargar el tiempo actual.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadExamTime()
    return () => {
      cancelled = true
    }
  }, [examId, isEditExamPage])

  useEffect(() => {
    if (!isEditExamPage || !examId || !currentMinutes) return

    const originalFetch = window.fetch.bind(window)

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
      const method = String(init?.method || "GET").toUpperCase()

      if (url.includes("/api/agents/examen-docente") && method === "POST" && typeof init?.body === "string") {
        try {
          const body = JSON.parse(init.body)
          if (body?.action === "update" && body?.examId === examId && body?.settings && typeof body.settings === "object") {
            const nextBody = {
              ...body,
              settings: {
                ...body.settings,
                timeLimit: currentMinutes,
                timeLimitAppliesTo: "new_attempts",
              },
            }
            return originalFetch(input, { ...init, body: JSON.stringify(nextBody) })
          }
        } catch {
          // Si no se puede leer el body, se deja pasar la petición original.
        }
      }

      return originalFetch(input, init)
    }

    return () => {
      window.fetch = originalFetch
    }
  }, [currentMinutes, examId, isEditExamPage])

  if (!isEditExamPage) return null

  async function saveTime(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextMinutes = normalizeMinutes(draftMinutes, currentMinutes || 30)

    if (nextMinutes < 5 || nextMinutes > 240) {
      setError("El tiempo debe estar entre 5 y 240 minutos.")
      return
    }

    setSaving(true)
    setError("")
    setMessage("")

    try {
      const supabase = createClient()
      const { data: authData } = await supabase.auth.getUser()
      const teacherId = authData?.user?.id

      if (!teacherId) {
        throw new Error("Debes iniciar sesión para editar el tiempo.")
      }

      const response = await fetch("/api/agents/exam-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId, teacherId, timeLimit: nextMinutes }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "No se pudo actualizar el tiempo.")
      }

      setCurrentMinutes(nextMinutes)
      setDraftMinutes(String(nextMinutes))
      setMessage(`Tiempo actualizado a ${nextMinutes} min. Aplica a nuevos intentos.`)
      setOpen(false)
    } catch (err: any) {
      setError(err?.message || "No se pudo actualizar el tiempo.")
    } finally {
      setSaving(false)
    }
  }

  const quickOptions = [30, 45, 60, 90, 120, 150]

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          setError("")
          setMessage("")
        }}
        className="fixed right-5 top-24 z-[70] flex items-center gap-2 rounded-full border border-emerald-200 bg-white/95 px-4 py-2 text-xs font-black text-emerald-800 shadow-lg shadow-emerald-100/70 backdrop-blur transition hover:-translate-y-0.5 hover:bg-emerald-50"
        title="Editar tiempo de evaluación"
      >
        <span>🕒</span>
        <span>Editar tiempo</span>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">
          {loading ? "..." : `${currentMinutes || 0} min`}
        </span>
      </button>

      {message && !open && (
        <div className="fixed right-5 top-36 z-[70] max-w-xs rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-xs font-semibold text-emerald-800 shadow-lg">
          {message}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-end bg-slate-950/30 p-4 pt-24 backdrop-blur-sm">
          <form onSubmit={saveTime} className="w-full max-w-sm rounded-3xl border border-emerald-100 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black text-slate-900">Editar tiempo de evaluación</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Aplica solo a estudiantes que inicien un nuevo intento después de guardar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            <label className="mt-4 block text-[11px] font-bold uppercase tracking-widest text-slate-500">
              Minutos
            </label>
            <input
              type="number"
              min={5}
              max={240}
              step={1}
              value={draftMinutes}
              onChange={(event) => setDraftMinutes(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-emerald-100 bg-emerald-50/40 px-4 py-3 text-lg font-black text-slate-900 outline-none focus:border-emerald-400"
            />

            <div className="mt-3 flex flex-wrap gap-2">
              {quickOptions.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => setDraftMinutes(String(minutes))}
                  className="rounded-full border border-emerald-100 bg-white px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50"
                >
                  {minutes} min
                </button>
              ))}
            </div>

            <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
              Si hay estudiantes con intento activo y quieres bajar el tiempo, el sistema lo bloqueará para no recortarles el tiempo guardado.
            </div>

            {error && (
              <div className="mt-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
                {error}
              </div>
            )}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-black text-white shadow-lg shadow-emerald-100 disabled:opacity-60"
              >
                {saving ? "Guardando..." : "Guardar tiempo"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
