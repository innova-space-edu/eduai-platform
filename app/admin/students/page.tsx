"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Search, RefreshCw, UserPlus, Pencil, Power, X } from "lucide-react"

type Student = {
  id: string
  school_year: string
  course: string
  student_name: string
  rut: string
  active: boolean
  source: string
  updated_at: string
}

const MEDIA_COURSES = [
  "1° Medio A", "1° Medio B", "2° Medio A", "2° Medio B",
  "3° Medio A", "3° Medio B", "4° Medio A", "4° Medio B",
]

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [courses, setCourses] = useState<string[]>(MEDIA_COURSES)
  const [course, setCourse] = useState("")
  const [status, setStatus] = useState("active")
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [total, setTotal] = useState(0)
  const [editing, setEditing] = useState<Student | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ studentName: "", rut: "", course: "1° Medio A", active: true })
  const [saving, setSaving] = useState(false)

  async function loadStudents() {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams({ schoolYear: "2026", status })
      if (course) params.set("course", course)
      if (search) params.set("search", search)
      const response = await fetch(`/api/admin/students?${params.toString()}`, { cache: "no-store" })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "No se pudo cargar la nómina")
      setStudents(data.students || [])
      setTotal(data.total || 0)
      if (Array.isArray(data.courses) && data.courses.length) setCourses(data.courses)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la nómina")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadStudents() }, [course, status, search])

  const grouped = useMemo(() => {
    const map = new Map<string, Student[]>()
    for (const student of students) {
      const list = map.get(student.course) || []
      list.push(student)
      map.set(student.course, list)
    }
    return [...map.entries()]
  }, [students])

  function openCreate() {
    setEditing(null)
    setCreating(true)
    setForm({ studentName: "", rut: "", course: course || "1° Medio A", active: true })
  }

  function openEdit(student: Student) {
    setCreating(false)
    setEditing(student)
    setForm({ studentName: student.student_name, rut: student.rut, course: student.course, active: student.active })
  }

  function closeModal() {
    setEditing(null)
    setCreating(false)
  }

  async function saveStudent() {
    setSaving(true)
    setError("")
    try {
      const response = await fetch("/api/admin/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsert",
          id: editing?.id,
          schoolYear: "2026",
          studentName: form.studentName,
          rut: form.rut,
          course: form.course,
          active: form.active,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "No se pudo guardar")
      closeModal()
      await loadStudents()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar")
    } finally {
      setSaving(false)
    }
  }

  async function toggleStudent(student: Student) {
    setError("")
    try {
      const response = await fetch("/api/admin/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_active", id: student.id, active: !student.active }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "No se pudo actualizar")
      await loadStudents()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar")
    }
  }

  return (
    <main className="min-h-screen bg-app text-main">
      <header className="sticky top-0 z-20 border-b border-soft bg-app/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-4 lg:px-6">
          <Link href="/admin" className="flex h-9 w-9 items-center justify-center rounded-xl border border-soft bg-card-soft-theme text-sub">
            <ArrowLeft size={16} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold">Alumnos · Nómina institucional</h1>
            <p className="text-xs text-muted2">Fuente central para exámenes, evaluaciones y administración · año 2026</p>
          </div>
          <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white">
            <UserPlus size={16} /> <span className="hidden sm:inline">Agregar alumno</span>
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 lg:px-6">
        <section className="grid gap-3 rounded-2xl border border-soft bg-card p-4 md:grid-cols-[1fr_220px_180px_auto]">
          <form onSubmit={(event) => { event.preventDefault(); setSearch(searchInput.trim()) }} className="relative">
            <Search className="absolute left-3 top-3.5 text-muted2" size={16} />
            <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Buscar por nombre o RUT/IPE" className="w-full rounded-xl border border-soft bg-app py-3 pl-10 pr-3 text-sm outline-none" />
          </form>
          <select value={course} onChange={(e) => setCourse(e.target.value)} className="rounded-xl border border-soft bg-app px-3 py-3 text-sm">
            <option value="">Todos los cursos</option>
            {courses.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-soft bg-app px-3 py-3 text-sm">
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
            <option value="all">Todos</option>
          </select>
          <button onClick={() => { setSearch(searchInput.trim()); void loadStudents() }} className="inline-flex items-center justify-center gap-2 rounded-xl border border-soft px-4 py-3 text-sm font-semibold text-sub">
            <RefreshCw size={15} /> Actualizar
          </button>
        </section>

        <div className="flex items-center justify-between text-sm">
          <p className="text-sub"><strong className="text-main">{total}</strong> registros encontrados</p>
          <p className="text-xs text-muted2">Los RUT/IPE solo se muestran dentro del panel administrativo.</p>
        </div>

        {error ? <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-500">{error}</div> : null}

        {loading ? (
          <div className="py-16 text-center text-sm text-muted2">Cargando nómina...</div>
        ) : grouped.length === 0 ? (
          <div className="rounded-2xl border border-soft bg-card p-10 text-center text-sm text-muted2">No hay estudiantes para estos filtros.</div>
        ) : (
          <div className="space-y-5">
            {grouped.map(([courseName, rows]) => (
              <section key={courseName} className="overflow-hidden rounded-2xl border border-soft bg-card">
                <div className="flex items-center justify-between border-b border-soft px-4 py-3">
                  <h2 className="font-bold">{courseName}</h2>
                  <span className="rounded-full bg-card-soft-theme px-2.5 py-1 text-xs font-bold text-sub">{rows.length}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-card-soft-theme text-xs uppercase tracking-wide text-muted2">
                      <tr><th className="px-4 py-3">Alumno</th><th className="px-4 py-3">RUT / IPE</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Origen</th><th className="px-4 py-3 text-right">Acciones</th></tr>
                    </thead>
                    <tbody className="divide-y divide-soft">
                      {rows.map((student) => (
                        <tr key={student.id}>
                          <td className="px-4 py-3 font-semibold">{student.student_name}</td>
                          <td className="px-4 py-3 font-mono text-sub">{student.rut}</td>
                          <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${student.active ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}`}>{student.active ? "Activo" : "Inactivo"}</span></td>
                          <td className="px-4 py-3 text-xs text-muted2">{student.source}</td>
                          <td className="px-4 py-3"><div className="flex justify-end gap-2"><button onClick={() => openEdit(student)} className="rounded-lg border border-soft p-2 text-sub" title="Editar"><Pencil size={14} /></button><button onClick={() => void toggleStudent(student)} className="rounded-lg border border-soft p-2 text-sub" title={student.active ? "Desactivar" : "Activar"}><Power size={14} /></button></div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {(creating || editing) ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-soft bg-card p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-bold">{editing ? "Editar alumno" : "Agregar alumno"}</h2><p className="text-xs text-muted2">Los cambios se aplican al padrón central.</p></div><button onClick={closeModal} className="rounded-xl border border-soft p-2 text-sub"><X size={16} /></button></div>
            <div className="mt-5 space-y-4">
              <label className="block"><span className="mb-1 block text-xs font-bold text-sub">Nombre completo</span><input value={form.studentName} onChange={(e) => setForm({ ...form, studentName: e.target.value })} className="w-full rounded-xl border border-soft bg-app px-3 py-3 text-sm" /></label>
              <label className="block"><span className="mb-1 block text-xs font-bold text-sub">RUT / IPE</span><input value={form.rut} onChange={(e) => setForm({ ...form, rut: e.target.value })} className="w-full rounded-xl border border-soft bg-app px-3 py-3 text-sm" /></label>
              <label className="block"><span className="mb-1 block text-xs font-bold text-sub">Curso</span><select value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} className="w-full rounded-xl border border-soft bg-app px-3 py-3 text-sm">{courses.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
              <label className="flex items-center gap-3 rounded-xl border border-soft bg-app px-3 py-3 text-sm"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Alumno activo</label>
            </div>
            <div className="mt-6 flex justify-end gap-2"><button onClick={closeModal} className="rounded-xl border border-soft px-4 py-2.5 text-sm font-semibold text-sub">Cancelar</button><button onClick={() => void saveStudent()} disabled={saving} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? "Guardando..." : "Guardar"}</button></div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
