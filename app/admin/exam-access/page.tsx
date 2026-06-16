"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"

type Exam = { id: string; title: string; topic?: string; code?: string; status?: string; created_at?: string }
type Student = { id: string; studentName: string; course: string; rutMasked: string }
type AccessCode = { id: string; student_name: string; course: string; code_hint: string; status: string; expires_at: string; used_at?: string; created_at: string }

const COURSE_OPTIONS = ["1° Medio A", "1° Medio B", "2° Medio A", "2° Medio B", "3° Medio A", "3° Medio B", "4° Medio A", "4° Medio B"]

export default function ExamAccessPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [sessionToken, setSessionToken] = useState("")
  const [exams, setExams] = useState<Exam[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [codes, setCodes] = useState<AccessCode[]>([])
  const [examId, setExamId] = useState("")
  const [course, setCourse] = useState("1° Medio A")
  const [studentId, setStudentId] = useState("")
  const [query, setQuery] = useState("")
  const [minutes, setMinutes] = useState(45)
  const [generated, setGenerated] = useState<any>(null)
  const [busy, setBusy] = useState(false)

  async function api(body: any) {
    const res = await fetch("/api/exam-access", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.success) throw new Error(data.error || "No se pudo procesar la solicitud")
    return data
  }

  useEffect(() => {
    let alive = true
    async function init() {
      try {
        setLoading(true)
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        if (!token) throw new Error("Debes iniciar sesión como docente")
        if (!alive) return
        setSessionToken(token)
      } catch (err: any) {
        if (!alive) return
        setError(err?.message || "No se pudo cargar la sesión")
      } finally {
        if (alive) setLoading(false)
      }
    }
    void init()
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!sessionToken) return
    void loadExams()
    void loadRoster()
  }, [sessionToken])

  useEffect(() => {
    if (!sessionToken) return
    void loadRoster()
  }, [course])

  useEffect(() => {
    if (!sessionToken || !examId) return
    void loadCodes()
  }, [sessionToken, examId])

  async function loadExams() {
    try {
      const data = await api({ action: "list_exams" })
      setExams(data.exams || [])
      if (!examId && data.exams?.[0]) setExamId(data.exams[0].id)
    } catch (err: any) {
      setError(err.message)
    }
  }

  async function loadRoster() {
    try {
      const data = await api({ action: "list_roster", course, schoolYear: "2026" })
      setStudents(data.students || [])
      setStudentId("")
    } catch (err: any) {
      setError(err.message)
    }
  }

  async function loadCodes() {
    try {
      const data = await api({ action: "list_codes", examId })
      setCodes(data.codes || [])
    } catch (err: any) {
      setError(err.message)
    }
  }

  async function generateCode() {
    if (!examId || !studentId) {
      setError("Selecciona un examen y un estudiante")
      return
    }
    try {
      setBusy(true)
      setError("")
      const data = await api({ action: "generate_code", examId, studentId, expiresMinutes: minutes })
      setGenerated(data)
      await loadCodes()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const filteredStudents = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return students
    return students.filter((s) => `${s.studentName} ${s.rutMasked}`.toLowerCase().includes(needle))
  }, [students, query])

  if (loading) {
    return <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900">Cargando...</main>
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-600">Acceso seguro</p>
            <h1 className="text-3xl font-black">Códigos de examen por estudiante</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Usa esta pantalla cuando un estudiante no sabe su RUT. El código es temporal, se guarda como hash y no muestra el RUT al estudiante.
            </p>
          </div>
          <Link href="/admin/exam-security" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm">
            Volver a seguridad
          </Link>
        </div>

        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div> : null}

        <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">Generar código de un solo uso</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-black uppercase tracking-widest text-slate-500">Examen</span>
                <select value={examId} onChange={(e) => setExamId(e.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm">
                  <option value="">Seleccionar examen</option>
                  {exams.map((exam) => (
                    <option key={exam.id} value={exam.id}>{exam.title} · {exam.status}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-black uppercase tracking-widest text-slate-500">Curso</span>
                <select value={course} onChange={(e) => setCourse(e.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm">
                  {COURSE_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>

              <label className="block md:col-span-2">
                <span className="mb-1 block text-xs font-black uppercase tracking-widest text-slate-500">Buscar estudiante</span>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nombre o RUT enmascarado" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
              </label>

              <label className="block md:col-span-2">
                <span className="mb-1 block text-xs font-black uppercase tracking-widest text-slate-500">Estudiante</span>
                <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm">
                  <option value="">Seleccionar estudiante</option>
                  {filteredStudents.map((s) => <option key={s.id} value={s.id}>{s.studentName} · {s.rutMasked}</option>)}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-black uppercase tracking-widest text-slate-500">Vigencia</span>
                <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm">
                  <option value={30}>30 minutos</option>
                  <option value={45}>45 minutos</option>
                  <option value={60}>60 minutos</option>
                  <option value={90}>90 minutos</option>
                </select>
              </label>

              <button onClick={generateCode} disabled={busy || !examId || !studentId} className="self-end rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm disabled:opacity-40">
                {busy ? "Generando..." : "Generar código"}
              </button>
            </div>

            {generated?.code ? (
              <div className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-xs font-black uppercase tracking-widest text-emerald-700">Código para entregar al estudiante</p>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-mono text-4xl font-black tracking-widest text-emerald-950">{generated.code}</p>
                  <button onClick={() => navigator.clipboard?.writeText(generated.code)} className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-emerald-700 shadow-sm">Copiar</button>
                </div>
                <p className="mt-2 text-sm text-emerald-800">{generated.student?.studentName} · {generated.student?.course} · vence {new Date(generated.expiresAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            ) : null}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-black">Códigos recientes</h2>
              <button onClick={loadCodes} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold">Actualizar</button>
            </div>
            <div className="mt-4 space-y-3">
              {codes.length === 0 ? <p className="text-sm text-slate-500">No hay códigos recientes para este examen.</p> : null}
              {codes.map((code) => (
                <div key={code.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-slate-900">{code.student_name}</p>
                    <span className="rounded-full bg-white px-2 py-1 text-[11px] font-black uppercase text-slate-600">{code.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Curso: {code.course} · Código termina en {code.code_hint || "----"}</p>
                  <p className="mt-1 text-xs text-slate-500">Vence: {new Date(code.expires_at).toLocaleString("es-CL")}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
