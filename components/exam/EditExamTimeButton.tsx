"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

const COURSE_OPTIONS = [
  "Sala cuna menor",
  "Sala cuna mayor",
  "Medio menor",
  "Medio mayor",
  "NT1",
  "NT2",
  "1° básico",
  "2° básico",
  "3° básico",
  "4° básico",
  "5° básico",
  "6° básico",
  "7° básico",
  "8° básico",
  "1° medio",
  "2° medio",
  "3° medio",
  "4° medio",
]

const SUBJECT_OPTIONS = [
  "Matemática",
  "Lenguaje",
  "Ciencias Naturales",
  "Física",
  "Química",
  "Biología",
  "Historia",
  "Geografía y Ciencias Sociales",
  "Educación Ciudadana",
  "Ciencias para la Ciudadanía",
  "Inglés",
  "Tecnología",
  "Filosofía",
  "Artes Visuales",
  "Música",
  "Educación Física y Salud",
  "Orientación",
  "Otra",
]

function parseExamId(pathname: string | null) {
  const match = pathname?.match(/^\/examen\/editar\/([^/?#]+)/)
  return match?.[1] || ""
}

function normalizeMinutes(value: unknown, fallback = 30) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(1, Math.min(240, Math.round(numeric)))
}

function readCourse(settings: any) {
  return String(settings?.curriculum?.curso || settings?.course || "").trim()
}

function readSubject(settings: any) {
  return String(settings?.subject || "").trim()
}

export default function EditExamTimeButton() {
  const pathname = usePathname()
  const examId = useMemo(() => parseExamId(pathname), [pathname])
  const isEditExamPage = Boolean(examId)

  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [currentMinutes, setCurrentMinutes] = useState<number | null>(null)
  const [currentCourse, setCurrentCourse] = useState("")
  const [currentSubject, setCurrentSubject] = useState("")
  const [currentSettings, setCurrentSettings] = useState<Record<string, any>>({})
  const [draftMinutes, setDraftMinutes] = useState("120")
  const [draftCourse, setDraftCourse] = useState("")
  const [draftSubject, setDraftSubject] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (!isEditExamPage) return

    let cancelled = false
    async function loadExamData() {
      setLoading(true)
      setError("")
      try {
        const response = await fetch(`/api/agents/examen-docente?examId=${examId}`)
        const data = await response.json().catch(() => ({}))
        if (!response.ok || !data?.exam) {
          throw new Error(data?.error || "No se pudo cargar la evaluación.")
        }

        const settings = data.exam.settings && typeof data.exam.settings === "object"
          ? data.exam.settings
          : {}
        const minutes = normalizeMinutes(settings.timeLimit, 30)
        const course = readCourse(settings)
        const subject = readSubject(settings)

        if (cancelled) return
        setCurrentSettings(settings)
        setCurrentMinutes(minutes)
        setCurrentCourse(course)
        setCurrentSubject(subject)
        setDraftMinutes(String(minutes))
        setDraftCourse(course)
        setDraftSubject(subject)
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "No se pudieron cargar los datos actuales.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadExamData()
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
          if (body?.source === "edit-data-panel") {
            return originalFetch(input, init)
          }

          if (body?.action === "update" && body?.examId === examId && body?.settings && typeof body.settings === "object") {
            const nextSettings: Record<string, any> = {
              ...body.settings,
              timeLimit: currentMinutes,
              timeLimitAppliesTo: "new_attempts",
            }

            if (currentSubject) {
              nextSettings.subject = currentSubject
            }

            if (currentCourse) {
              nextSettings.curriculum = {
                ...(body.settings.curriculum || {}),
                curso: currentCourse,
              }
            }

            const nextBody = {
              ...body,
              settings: nextSettings,
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
  }, [currentCourse, currentMinutes, currentSubject, examId, isEditExamPage])

  if (!isEditExamPage) return null

  async function saveConfiguration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextMinutes = normalizeMinutes(draftMinutes, currentMinutes || 30)
    const nextCourse = draftCourse.trim()
    const nextSubject = draftSubject.trim()

    if (!nextCourse || !nextSubject) {
      setError("Selecciona el curso y la asignatura.")
      return
    }

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
        throw new Error("Debes iniciar sesión para editar la evaluación.")
      }

      const timeResponse = await fetch("/api/agents/exam-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId, teacherId, timeLimit: nextMinutes }),
      })

      const timeData = await timeResponse.json().catch(() => ({}))
      if (!timeResponse.ok || !timeData?.success) {
        throw new Error(timeData?.error || "No se pudo actualizar el tiempo.")
      }

      const nextSettings = {
        ...currentSettings,
        subject: nextSubject,
        curriculum: {
          ...(currentSettings?.curriculum || {}),
          curso: nextCourse,
        },
        timeLimit: nextMinutes,
        timeLimitAppliesTo: "new_attempts",
      }

      const metadataResponse = await fetch("/api/agents/examen-docente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "edit-data-panel",
          action: "update",
          examId,
          teacherId,
          settings: nextSettings,
        }),
      })

      const metadataData = await metadataResponse.json().catch(() => ({}))
      if (!metadataResponse.ok || !metadataData?.success) {
        throw new Error(metadataData?.error || "No se pudieron actualizar el curso y la asignatura.")
      }

      setCurrentSettings(nextSettings)
      setCurrentMinutes(nextMinutes)
      setCurrentCourse(nextCourse)
      setCurrentSubject(nextSubject)
      setDraftMinutes(String(nextMinutes))
      setDraftCourse(nextCourse)
      setDraftSubject(nextSubject)
      setMessage(`Datos actualizados: ${nextCourse} · ${nextSubject} · ${nextMinutes} min.`)
      setOpen(false)
    } catch (err: any) {
      setError(err?.message || "No se pudieron actualizar los datos de la evaluación.")
    } finally {
      setSaving(false)
    }
  }

  const quickOptions = [30, 45, 60, 90, 120, 150]
  const customCourse = draftCourse && !COURSE_OPTIONS.includes(draftCourse)
  const customSubject = draftSubject && !SUBJECT_OPTIONS.includes(draftSubject)

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          setError("")
          setMessage("")
          setDraftMinutes(String(currentMinutes || 30))
          setDraftCourse(currentCourse)
          setDraftSubject(currentSubject)
        }}
        className="fixed right-5 top-24 z-[70] flex max-w-[calc(100vw-2.5rem)] items-center gap-2 rounded-full border border-emerald-200 bg-white/95 px-4 py-2 text-xs font-black text-emerald-800 shadow-lg shadow-emerald-100/70 backdrop-blur transition hover:-translate-y-0.5 hover:bg-emerald-50"
        title="Editar curso, asignatura y tiempo"
      >
        <span>⚙️</span>
        <span>Datos del examen</span>
        <span className="max-w-36 truncate rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">
          {loading ? "Cargando..." : currentCourse || "Sin curso"}
        </span>
      </button>

      {message && !open && (
        <div className="fixed right-5 top-36 z-[70] max-w-sm rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-xs font-semibold text-emerald-800 shadow-lg">
          {message}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-end bg-slate-950/30 p-4 pt-24 backdrop-blur-sm">
          <form onSubmit={saveConfiguration} className="max-h-[calc(100vh-7rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-emerald-100 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black text-slate-900">Datos del examen</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Cambia el curso y la asignatura usados para organizar la evaluación. También puedes ajustar su duración.
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

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Curso</span>
                <select
                  value={draftCourse}
                  onChange={(event) => setDraftCourse(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-emerald-100 bg-emerald-50/40 px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400"
                >
                  <option value="">Seleccionar curso</option>
                  {customCourse && <option value={draftCourse}>{draftCourse}</option>}
                  {COURSE_OPTIONS.map((course) => (
                    <option key={course} value={course}>{course}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Asignatura</span>
                <select
                  value={draftSubject}
                  onChange={(event) => setDraftSubject(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-emerald-100 bg-emerald-50/40 px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400"
                >
                  <option value="">Seleccionar asignatura</option>
                  {customSubject && <option value={draftSubject}>{draftSubject}</option>}
                  {SUBJECT_OPTIONS.map((subject) => (
                    <option key={subject} value={subject}>{subject}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="mt-4 block text-[11px] font-bold uppercase tracking-widest text-slate-500">
              Duración en minutos
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

            <div className="mt-4 rounded-2xl bg-blue-50 px-4 py-3 text-xs leading-relaxed text-blue-800">
              El curso y la asignatura se guardan en la configuración del examen. No se crea ninguna tabla nueva en Supabase.
            </div>

            <div className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
              El nuevo tiempo aplica a intentos iniciados después de guardar. Si existen intentos activos, el sistema evita recortarles su tiempo guardado.
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
                disabled={saving || loading}
                className="flex-1 rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-black text-white shadow-lg shadow-emerald-100 disabled:opacity-60"
              >
                {saving ? "Guardando..." : "Guardar datos"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
